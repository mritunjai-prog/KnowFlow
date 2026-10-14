import { afterEach, describe, expect, it, vi } from 'vitest';
import { request, json, key, query, safeUrl, setCsrfToken, ApiError } from './client';
afterEach(() => setCsrfToken(''));
describe('API boundary', () => {
  it('sends JSON with a private cookie session and CSRF protection', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'one' }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    setCsrfToken('test-csrf');
    expect(await request('/tasks', json('POST', { description: 'Read notes' }))).toEqual({
      id: 'one',
    });
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/tasks');
    expect(options.credentials).toBe('include');
    expect(options.headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });
  it('does not guess authenticated state or send unprotected mutations', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(request('/tasks', json('POST', {}))).rejects.toMatchObject({
      code: 'SESSION_REQUIRED',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not interpret SPA HTML as API success', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('<html>App</html>', { headers: { 'Content-Type': 'text/html' } }),
        ),
    );
    await expect(request('/session')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
  it('propagates structured permission failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied', fields: {} } }),
            { status: 403, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );
    await expect(request('/admin/config')).rejects.toMatchObject({
      status: 403,
      message: 'Access denied',
    });
  });
  it('invalidates session on 401 without exposing raw exceptions', async () => {
    const listener = vi.fn();
    window.addEventListener('knowflow:session-expired', listener);
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'SESSION_EXPIRED', message: 'Sign in again' } }),
            { status: 401, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    );
    await expect(request('/documents')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('knowflow:session-expired', listener);
  });
  it('lets fetch supply a multipart boundary', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    setCsrfToken('test');
    await request('/ingestions', { method: 'POST', body: new FormData() });
    expect(fetcher.mock.calls[0][1].headers.has('Content-Type')).toBe(false);
  });
  it('reports network failures truthfully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('internal network detail')));
    await expect(request('/documents')).rejects.toThrow('Cannot reach the KnowFlow service');
  });
  it('encodes identifiers and query values', () => {
    expect(key('../private/id')).toBe('..%2Fprivate%2Fid');
    expect(query({ q: 'a&b', page: 2, type: '' })).toBe('?q=a%26b&page=2');
  });
  it('rejects executable and insecure source URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,test')).toBeUndefined();
    expect(safeUrl('https://files.example.org/a.png')).toBe('https://files.example.org/a.png');
    expect(safeUrl('/api/v1/file/1')).toContain('/api/v1/file/1');
  });
});
