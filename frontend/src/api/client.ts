export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(
    message: string,
    status = 0,
    code = 'UNAVAILABLE',
    fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
let csrfToken = '';
export function setCsrfToken(value: string) {
  csrfToken = value;
}
const base = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, 45000);
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !(options.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  if (options.method && !['GET', 'HEAD'].includes(options.method)) {
    if (!csrfToken) {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      throw new ApiError(
        'Your session is not ready. Reload and try again.',
        401,
        'SESSION_REQUIRED',
      );
    }
    headers.set('X-CSRF-Token', csrfToken);
  }
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    if (response.status === 204) return undefined as T;
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new ApiError(
        'The KnowFlow service is unavailable or not configured. A saved result could not be confirmed.',
        response.status,
        'UNAVAILABLE',
      );
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = (
        body as { error?: { message?: string; code?: string; fields?: Record<string, string> } }
      )?.error;
      if (response.status === 401) window.dispatchEvent(new Event('knowflow:session-expired'));
      throw new ApiError(
        error?.message || `Request failed (${response.status}). Please try again.`,
        response.status,
        error?.code || 'REQUEST_FAILED',
        error?.fields,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    throw new ApiError(
      controller.signal.aborted
        ? 'The request timed out. Check its status before retrying.'
        : 'Cannot reach the KnowFlow service. Check your connection and try again.',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
export const json = (method: string, value?: unknown): RequestInit => ({
  method,
  ...(value !== undefined ? { body: JSON.stringify(value) } : {}),
});
export const key = (id: string) => encodeURIComponent(id);
export function query(values: Record<string, string | number | undefined>) {
  const result = new URLSearchParams();
  for (const [name, value] of Object.entries(values))
    if (value !== undefined && value !== '') result.set(name, String(value));
  return `?${result}`;
}
export function safeUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.protocol === 'https:' ||
      (url.origin === window.location.origin && url.protocol === window.location.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
