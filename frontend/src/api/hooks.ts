import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, request } from './client';
export function useResource<T>(path: string | null, poll = false) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    error: Error | null;
    loading: boolean;
  }>({ path: null, data: null, error: null, loading: false });
  const [version, setVersion] = useState(0);
  const polling = useRef(poll);
  useEffect(() => {
    polling.current = poll;
  }, [poll]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    setState((previous) => ({
      path,
      data: previous.path === path ? previous.data : null,
      error: null,
      loading: !!path,
    }));
    if (!path) return;
    async function load() {
      try {
        const data = await request<T>(path!, { signal: controller.signal });
        if (!controller.signal.aborted) setState({ path, data, error: null, loading: false });
      } catch (e) {
        if (!controller.signal.aborted)
          setState({
            path,
            data: null,
            error: e instanceof Error ? e : new Error('Unable to load data.'),
            loading: false,
          });
      } finally {
        if (!controller.signal.aborted && polling.current)
          timeout = setTimeout(() => {
            if (polling.current) void load();
          }, 3000);
      }
    }
    void load();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [path, version]);
  const current = state.path === path ? state : { data: null, error: null, loading: !!path };
  return { data: current.data, error: current.error, loading: current.loading, reload };
}
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState('');
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const run = async <T>(
    operation: (signal: AbortSignal) => Promise<T>,
    success?: (result: T) => void,
    notice = '',
  ) => {
    if (active.current) return;
    active.current = true;
    setPending(true);
    setError(null);
    setMessage('');
    const current = new AbortController();
    controller.current = current;
    try {
      const result = await operation(current.signal);
      if (!current.signal.aborted) {
        success?.(result);
        setMessage(notice);
      }
    } catch (e) {
      if (!current.signal.aborted)
        setError(e instanceof Error ? e : new ApiError('The action could not be completed.'));
    } finally {
      active.current = false;
      if (!current.signal.aborted) setPending(false);
    }
  };
  return {
    pending,
    error,
    message,
    run,
    clear: () => {
      setError(null);
      setMessage('');
    },
  };
}
