import { act, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { PixelCard } from './PixelCard';

afterEach(() => vi.restoreAllMocks());

it('cleans up observers, events and animation frames, including StrictMode and hidden tabs', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(640);
  const context = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  const disconnects: ReturnType<typeof vi.fn>[] = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect = vi.fn();
      private resize: () => void;
      constructor(resize: () => void) {
        this.resize = resize;
        disconnects.push(this.disconnect);
      }
      observe() {
        this.resize();
      }
    },
  );
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      disconnect = vi.fn();
      private update: (entries: { isIntersecting: boolean }[]) => void;
      constructor(update: (entries: { isIntersecting: boolean }[]) => void) {
        this.update = update;
        disconnects.push(this.disconnect);
      }
      observe() {
        this.update([{ isIntersecting: true }]);
      }
    },
  );
  let id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
  const view = render(
    <StrictMode>
      <PixelCard>
        <input aria-label="Email" />
      </PixelCard>
    </StrictMode>,
  );
  const card = view.container.querySelector('[data-pixel-card]')!;
  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  expect(frames.size).toBe(1);
  act(() => {
    const [frame, callback] = [...frames][0];
    frames.delete(frame);
    callback(100);
  });
  expect(frames.size).toBe(1);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(frames.size).toBe(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(frames.size).toBe(1);
  view.unmount();
  expect(frames.size).toBe(0);
  expect(disconnects).toHaveLength(4);
  disconnects.forEach((disconnect) => expect(disconnect).toHaveBeenCalledTimes(1));
  fireEvent.pointerEnter(card, { pointerType: 'mouse' });
  expect(frames.size).toBe(0);
});

it('retains usable children when a 2D canvas cannot be created', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  render(
    <PixelCard>
      <input aria-label="Email" />
    </PixelCard>,
  );
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reader@example.org' } });
  expect(screen.getByLabelText('Email')).toHaveValue('reader@example.org');
});
