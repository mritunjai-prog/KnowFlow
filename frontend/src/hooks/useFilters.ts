import { useSearchParams } from 'react-router-dom';
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const set = (name: string, value: string) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        if (name !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  return { params, set, page: Math.max(1, Number(params.get('page')) || 1) };
}
