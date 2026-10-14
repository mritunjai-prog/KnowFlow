import { act, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

it('reacts to preference changes without reload and cleans up its listener in StrictMode', () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: false,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  const { result, unmount } = renderHook(usePrefersReducedMotion, {
    wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
  });
  expect(result.current).toBe(false);
  expect(listeners.size).toBe(1);
  act(() => {
    media.matches = true;
    listeners.forEach((listener) => listener());
  });
  expect(result.current).toBe(true);
  act(() => {
    media.matches = false;
    listeners.forEach((listener) => listener());
  });
  expect(result.current).toBe(false);
  unmount();
  expect(listeners.size).toBe(0);
});
