import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useAction, useResource } from './hooks';
it('does not report success for a rejected mutation', async () => {
  const onSuccess = vi.fn();
  const { result } = renderHook(useAction);
  await act(async () => {
    await result.current.run(() => Promise.reject(new Error('Denied')), onSuccess, 'Saved');
  });
  expect(result.current.message).toBe('');
  expect(result.current.error?.message).toBe('Denied');
  expect(onSuccess).not.toHaveBeenCalled();
});
it('prevents overlapping submissions even before the button rerenders', async () => {
  let finish!: () => void;
  const operation = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(useAction);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.run(operation);
    void result.current.run(operation);
  });
  expect(operation).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await pending;
  });
  expect(result.current.pending).toBe(false);
});
it('aborts an obsolete resource and ignores a late result', async () => {
  const resolvers: ((value: Response) => void)[] = [];
  const calls: RequestInit[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, options: RequestInit) => {
      calls.push(options);
      return new Promise<Response>((resolve) => resolvers.push(resolve));
    }),
  );
  const { result, rerender } = renderHook(({ path }) => useResource<{ name: string }>(path), {
    initialProps: { path: '/documents/old' },
  });
  rerender({ path: '/documents/new' });
  expect(calls[0].signal?.aborted).toBe(true);
  await act(async () => {
    resolvers[1](
      new Response(JSON.stringify({ name: 'new' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  await waitFor(() => expect(result.current.data?.name).toBe('new'));
  await act(async () => {
    resolvers[0](
      new Response(JSON.stringify({ name: 'old' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
  expect(result.current.data?.name).toBe('new');
});
