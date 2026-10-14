import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { ErrorNotice, Notice } from './Feedback';
export function MediaCapture({
  mode,
  onCapture,
  maxSeconds = 60,
  disabled = false,
  onActiveChange,
  acceptedMimeTypes,
}: {
  mode: 'image' | 'audio';
  onCapture: (file: File) => void;
  maxSeconds?: number;
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  acceptedMimeTypes?: string[];
}) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [seconds, setSeconds] = useState(0);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const captureCallback = useRef(onCapture);
  const activityCallback = useRef(onActiveChange);
  useEffect(() => {
    captureCallback.current = onCapture;
    activityCallback.current = onActiveChange;
  }, [onCapture, onActiveChange]);
  useEffect(() => {
    activityCallback.current?.(active || starting);
  }, [active, starting]);
  const finish = () => {
    if (recorder.current?.state === 'recording') {
      if (mounted.current) setStarting(true);
      recorder.current.stop();
    }
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (timer.current) clearInterval(timer.current);
    if (mounted.current) setActive(false);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        recorder.current.ondataavailable = null;
      }
      finish();
    };
  }, []);
  const start = async () => {
    setError(null);
    setStarting(true);
    setSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error(
          'Media capture is unavailable. Use a secure HTTPS browser or upload a file.',
        );
      if (mode === 'audio' && typeof MediaRecorder === 'undefined')
        throw new Error(
          'Audio recording is unavailable in this browser. Upload an audio file instead.',
        );
      const media = await navigator.mediaDevices.getUserMedia(
        mode === 'image' ? { video: { facingMode: 'environment' } } : { audio: true },
      );
      if (!mounted.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      setActive(true);
      if (mode === 'image') {
        if (video.current) {
          video.current.srcObject = media;
          await video.current.play();
        }
      } else {
        const mimeType = acceptedMimeTypes
          ?.filter((type) => type.startsWith('audio/'))
          .find((type) => MediaRecorder.isTypeSupported(type));
        if (acceptedMimeTypes && !mimeType)
          throw new Error(
            'This browser cannot record a server-supported audio format. Upload an audio file instead.',
          );
        const recording = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
        recorder.current = recording;
        const chunks: Blob[] = [];
        recording.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recording.onerror = () => {
          setError(new Error('Recording failed. Please try again or upload an audio file.'));
          recording.onstop = null;
          finish();
          setStarting(false);
        };
        recording.onstop = () => {
          if (!mounted.current) return;
          finish();
          setStarting(false);
          if (!chunks.length) {
            setError(new Error('The recording was empty. Please try again.'));
            return;
          }
          const mime = recording.mimeType.split(';')[0];
          const extension = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
          captureCallback.current(
            new File(chunks, `recording-${Date.now()}.${extension}`, { type: mime }),
          );
        };
        recording.start(250);
        let elapsed = 0;
        timer.current = setInterval(() => {
          elapsed++;
          setSeconds(elapsed);
          if (elapsed >= maxSeconds) finish();
        }, 1000);
      }
    } catch (e) {
      finish();
      if (mounted.current)
        setError(
          new Error(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Permission was denied. Allow camera/microphone access or upload a file.'
              : e instanceof Error
                ? e.message
                : 'Unable to start capture.',
          ),
        );
    } finally {
      if (mounted.current) setStarting(false);
    }
  };
  const photo = () => {
    if (!video.current?.videoWidth) {
      setError(new Error('The camera is still starting. Try again in a moment.'));
      return;
    }
    setStarting(true);
    const canvas = document.createElement('canvas');
    canvas.width = video.current.videoWidth;
    canvas.height = video.current.videoHeight;
    canvas.getContext('2d')?.drawImage(video.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!mounted.current) return;
      setStarting(false);
      if (blob)
        captureCallback.current(
          new File([blob], `capture-${Date.now()}.png`, { type: 'image/png' }),
        );
      else setError(new Error('Unable to capture the image. Try again or upload a file.'));
    }, 'image/png');
    finish();
  };
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">{mode === 'image' ? 'Camera capture' : 'Audio recording'}</h3>
      <ErrorNotice error={error} />
      {mode === 'image' && (
        <video
          ref={video}
          muted
          playsInline
          aria-label="Live camera preview"
          className={`${active ? 'block' : 'hidden'} max-h-72 w-full rounded-xl bg-primary object-contain`}
        />
      )}
      {active ? (
        <div className="flex flex-wrap gap-2">
          {mode === 'image' && <Button onClick={photo}>Take photo</Button>}
          <Button variant="secondary" onClick={finish}>
            {mode === 'audio' ? 'Stop and attach recording' : 'Cancel camera'}
          </Button>
          {mode === 'audio' && (
            <Notice>
              Recording: {seconds}s / {maxSeconds}s. Stop to review before upload.
            </Notice>
          )}
        </div>
      ) : (
        <Button variant="secondary" disabled={starting || disabled} onClick={() => void start()}>
          {starting
            ? 'Waiting for permission…'
            : mode === 'image'
              ? 'Open camera'
              : 'Start recording'}
        </Button>
      )}
      <p className="text-sm text-primary/80">
        {mode === 'image'
          ? 'Use a well-lit, flat page. You can remove a capture and retake it before uploading.'
          : 'Record only with participants’ permission. Nothing is uploaded until you submit the intake.'}
      </p>
    </div>
  );
}
