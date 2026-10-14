import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { MediaCapture } from './MediaCapture';
it('shows a recoverable camera permission error', async () => {
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError')),
    },
  });
  render(<MediaCapture mode="image" onCapture={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open camera' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Permission was denied');
  expect(screen.getByRole('button', { name: 'Open camera' })).toBeEnabled();
});
it('stops a stream that arrives after capture was unmounted', async () => {
  const stop = vi.fn();
  let resolve!: (stream: MediaStream) => void;
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    },
  });
  const view = render(<MediaCapture mode="image" onCapture={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Open camera' }));
  view.unmount();
  resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  await waitFor(() => expect(stop).toHaveBeenCalledTimes(1));
});
it('attaches recorded audio only after stopping and releases the microphone', async () => {
  const stop = vi.fn();
  const captured = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) },
  });
  class Recorder {
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = 'recording';
      this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  render(<MediaCapture mode="audio" onCapture={captured} maxSeconds={30} />);
  await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  expect(captured).not.toHaveBeenCalled();
  await userEvent.click(await screen.findByRole('button', { name: 'Stop and attach recording' }));
  expect(captured).toHaveBeenCalledTimes(1);
  expect(captured.mock.calls[0][0].type).toBe('audio/webm');
  expect(stop).toHaveBeenCalled();
});
it('uses the latest capture callback after a recording has started', async () => {
  const first = vi.fn();
  const latest = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    },
  });
  class Recorder {
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    start() {
      this.state = 'recording';
      this.ondataavailable?.({ data: new Blob(['audio']) });
    }
    stop() {
      this.state = 'inactive';
      this.onstop?.();
    }
  }
  vi.stubGlobal('MediaRecorder', Recorder);
  const view = render(<MediaCapture mode="audio" onCapture={first} />);
  await userEvent.click(screen.getByRole('button', { name: 'Start recording' }));
  view.rerender(<MediaCapture mode="audio" onCapture={latest} />);
  await userEvent.click(screen.getByRole('button', { name: 'Stop and attach recording' }));
  expect(first).not.toHaveBeenCalled();
  expect(latest).toHaveBeenCalledTimes(1);
});
