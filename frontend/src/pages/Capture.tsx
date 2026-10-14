import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResource, useAction } from '../api/hooks';
import { request } from '../api/client';
import type { Capabilities, Job, Settings } from '../api/types';
import {
  Page,
  Panel,
  Loading,
  ErrorNotice,
  Field,
  fieldClass,
  Notice,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { MediaCapture } from '../components/ui/MediaCapture';
import { validateFiles } from '../lib/intake';
import { bytes, tags } from '../lib/utils';
function Preview({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const value = URL.createObjectURL(file);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [file]);
  if (file.type.startsWith('image/'))
    return (
      <img src={url} alt={`Preview of ${file.name}`} className="max-h-40 rounded object-contain" />
    );
  if (file.type.startsWith('audio/'))
    return (
      <audio src={url} controls className="max-w-full" aria-label={`Preview of ${file.name}`} />
    );
  return null;
}
export function Capture() {
  const caps = useResource<Capabilities>('/capabilities');
  const settings = useResource<Settings>('/settings');
  const action = useAction();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [topics, setTopics] = useState('');
  const [type, setType] = useState('');
  const [meeting, setMeeting] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<File[]>([]);
  const submission = useRef<{ signature: string; files: File[]; key: string } | null>(null);
  const [captureActive, setCaptureActive] = useState({ camera: false, audio: false });
  const updateFiles = (next: File[]) => {
    filesRef.current = next;
    setFiles(next);
  };
  const add = (incoming: File[]) => {
    if (!caps.data) return;
    const next = [...filesRef.current, ...incoming];
    const problem = validateFiles(next, caps.data);
    if (problem) {
      setError(new Error(problem));
      return;
    }
    updateFiles(next);
    setError(null);
  };
  return (
    <Page
      title="Capture knowledge"
      description="Upload documents, capture a page, record audio or enter text. Review your inputs before processing."
    >
      <ErrorNotice error={caps.error} retry={caps.reload} />
      <ErrorNotice error={settings.error} retry={settings.reload} />
      {caps.loading && <Loading />}
      {caps.data && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            if (!files.length && !text.trim()) {
              setError(new Error('Add a file or some text before processing.'));
              return;
            }
            const problem = validateFiles(files, caps.data!);
            if (problem) {
              setError(new Error(problem));
              return;
            }
            const data = new FormData();
            files.forEach((file) => data.append('files', file));
            data.append('text', text.trim());
            const metadata = JSON.stringify({
              title: title.trim(),
              tags: tags(topics),
              documentType: type || null,
              meetingId: params.get('meetingId'),
              meetingTitle: meeting.trim() || null,
              occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
              captureSource:
                settings.data?.captureSource &&
                caps.data!.captureSources.includes(settings.data.captureSource)
                  ? settings.data.captureSource
                  : caps.data!.captureSources[0] || null,
              modelId: settings.data?.modelId || null,
            });
            data.append('metadata', metadata);
            const signature = JSON.stringify([text.trim(), metadata]);
            if (
              submission.current?.signature !== signature ||
              submission.current.files.length !== files.length ||
              !files.every((file, index) => file === submission.current!.files[index])
            )
              submission.current = { signature, files, key: crypto.randomUUID() };
            void action.run(
              (signal) =>
                request<Job>('/ingestions', {
                  method: 'POST',
                  body: data,
                  signal,
                  headers: { 'Idempotency-Key': submission.current!.key },
                }),
              (job) => navigate(`/processing/${encodeURIComponent(job.id)}`),
            );
          }}
        >
          <fieldset disabled={action.pending} className="min-w-0 space-y-6 disabled:opacity-70">
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel>
                <h2 className="mb-4 text-xl font-bold">Files and text</h2>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    if (action.pending) return;
                    if (!caps.data?.captureSources.includes('file')) {
                      setError(new Error('File intake is disabled by the administrator.'));
                      return;
                    }
                    add(Array.from(e.dataTransfer.files));
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 ${dragging ? 'border-secondary bg-white' : 'border-primary/30'}`}
                >
                  <Field
                    id="files"
                    label="Choose files or drop them here"
                    hint={`Up to ${caps.data.maxBatchFiles} files, ${bytes(caps.data.maxFileBytes)} each. Accepted: ${caps.data.acceptedMimeTypes.join(', ')}.`}
                  >
                    <input
                      id="files"
                      type="file"
                      disabled={!caps.data.captureSources.includes('file')}
                      multiple
                      accept={caps.data.acceptedMimeTypes.join(',')}
                      onChange={(e) => {
                        add(Array.from(e.target.files || []));
                        e.target.value = '';
                      }}
                      aria-describedby="files-hint"
                      className="w-full max-w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-2 file:text-white"
                    />
                  </Field>
                </div>
                <ul className="mt-4 space-y-4">
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="space-y-2 rounded-lg border border-primary/15 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 break-all text-sm">
                          {file.name} · {bytes(file.size)}
                        </span>
                        <Button
                          variant="ghost"
                          aria-label={`Remove ${file.name}`}
                          onClick={() =>
                            updateFiles(filesRef.current.filter((_, index) => index !== i))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <Preview file={file} />
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <Field id="draft" label="Text or transcript">
                    <textarea
                      id="draft"
                      disabled={!caps.data.captureSources.includes('text')}
                      className={fieldClass}
                      rows={7}
                      maxLength={caps.data.maxTextCharacters}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    disabled={!caps.data.captureSources.includes('text')}
                    onClick={() => {
                      void navigator.clipboard
                        ?.readText()
                        .then((value) => {
                          if (value.length > caps.data!.maxTextCharacters) {
                            setError(
                              new Error('Clipboard text exceeds the configured text limit.'),
                            );
                            return;
                          }
                          setText(value);
                        })
                        .catch(() =>
                          setError(
                            new Error(
                              'Clipboard access was denied. Paste directly into the text field.',
                            ),
                          ),
                        );
                      if (!navigator.clipboard)
                        setError(
                          new Error('Paste directly into the text field using your keyboard.'),
                        );
                    }}
                  >
                    Paste from clipboard
                  </Button>
                </div>
              </Panel>
              <Panel>
                <h2 className="mb-4 text-xl font-bold">Capture directly</h2>
                <div className="space-y-8">
                  <MediaCapture
                    mode="image"
                    onActiveChange={(active) =>
                      setCaptureActive((previous) =>
                        previous.camera === active ? previous : { ...previous, camera: active },
                      )
                    }
                    disabled={
                      !caps.data.captureSources.includes('camera') ||
                      !caps.data.acceptedMimeTypes.includes('image/png')
                    }
                    onCapture={(file) => add([file])}
                  />
                  <MediaCapture
                    mode="audio"
                    acceptedMimeTypes={caps.data.acceptedMimeTypes}
                    onActiveChange={(active) =>
                      setCaptureActive((previous) =>
                        previous.audio === active ? previous : { ...previous, audio: active },
                      )
                    }
                    disabled={
                      !caps.data.transcription || !caps.data.captureSources.includes('audio')
                    }
                    maxSeconds={caps.data.maxRecordingSeconds}
                    onCapture={(file) => add([file])}
                  />
                  {!caps.data.transcription && (
                    <Notice>Transcription is not yet configured on the server.</Notice>
                  )}
                </div>
              </Panel>
            </div>
            <Panel>
              <h2 className="mb-4 text-xl font-bold">Metadata</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="title" label="Title or batch label">
                  <input
                    id="title"
                    className={fieldClass}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                </Field>
                <Field id="topics" label="Topics (comma separated)">
                  <input
                    id="topics"
                    className={fieldClass}
                    value={topics}
                    onChange={(e) => setTopics(e.target.value)}
                    maxLength={500}
                  />
                </Field>
                <Field id="document-type" label="Document type">
                  <select
                    id="document-type"
                    className={fieldClass}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">Detect automatically</option>
                    {caps.data.documentTypes.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                {params.get('meetingId') ? (
                  <Notice>These files will be attached to the selected meeting.</Notice>
                ) : (
                  <>
                    <Field id="meeting" label="Meeting label (optional)">
                      <input
                        id="meeting"
                        className={fieldClass}
                        value={meeting}
                        onChange={(e) => setMeeting(e.target.value)}
                        maxLength={200}
                      />
                    </Field>
                    {meeting.trim() && (
                      <Field id="occurred-at" label="Meeting date and time">
                        <input
                          id="occurred-at"
                          type="datetime-local"
                          className={fieldClass}
                          value={occurredAt}
                          onChange={(e) => setOccurredAt(e.target.value)}
                          required
                        />
                      </Field>
                    )}
                  </>
                )}
              </div>
            </Panel>
          </fieldset>
          <ErrorNotice error={error || action.error} />
          <Button
            type="submit"
            disabled={
              action.pending ||
              captureActive.camera ||
              captureActive.audio ||
              settings.loading ||
              !!settings.error
            }
          >
            {action.pending ? 'Uploading…' : 'Process knowledge'}
          </Button>
          <Notice>
            {captureActive.camera || captureActive.audio
              ? 'Finish or cancel active media capture before submitting.'
              : ''}
          </Notice>
          <Notice>
            Files and text are sent to the configured KnowFlow backend only when you submit. Review
            processing results before relying on extracted information.
          </Notice>
        </form>
      )}
    </Page>
  );
}
