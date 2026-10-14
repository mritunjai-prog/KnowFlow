import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useResource, useAction } from '../api/hooks';
import { json, key, request, safeUrl } from '../api/client';
import type { DocumentRecord, FileSource } from '../api/types';
import {
  Page,
  Panel,
  ErrorNotice,
  Loading,
  Field,
  fieldClass,
  Notice,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { DocumentShares } from '../components/ui/DocumentShares';
import { date, tags } from '../lib/utils';
function SourceViewer({ file }: { file: FileSource | null }) {
  const [zoom, setZoom] = useState(1);
  const [params] = useSearchParams();
  const requestedPage = Number(params.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const rawUrl = safeUrl(file?.url);
  const url =
    file?.mediaType === 'application/pdf' && rawUrl
      ? `${rawUrl.split('#')[0]}#page=${page}`
      : rawUrl;
  if (!file || !url) return <p className="py-8">No source preview is available.</p>;
  return (
    <div className="space-y-4">
      {params.has('page') && (
        <Notice>
          Cited source page: {page}. Open the original source to inspect the complete page.
        </Notice>
      )}
      {file.mediaType.startsWith('image/') ? (
        <>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setZoom((v) => Math.max(0.5, v - 0.25))}
              disabled={zoom <= 0.5}
            >
              Zoom out
            </Button>
            <Button
              variant="secondary"
              onClick={() => setZoom((v) => Math.min(3, v + 0.25))}
              disabled={zoom >= 3}
            >
              Zoom in
            </Button>
          </div>
          <div className="max-h-[65dvh] overflow-auto rounded-lg bg-white p-2">
            <img src={url} alt={file.name} style={{ width: `${zoom * 100}%`, maxWidth: 'none' }} />
          </div>
        </>
      ) : file.mediaType.startsWith('audio/') ? (
        <audio controls src={url} className="w-full" aria-label={file.name} />
      ) : (
        <p>Use the source link to open this {file.mediaType} file in a supported viewer.</p>
      )}
      <a
        className="inline-block break-words underline"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open source: {file.name}
      </a>
    </div>
  );
}
function DocumentContent({ doc, reload }: { doc: DocumentRecord; reload: () => void }) {
  const [title, setTitle] = useState(doc.title);
  const [type, setType] = useState(doc.documentType);
  const [topics, setTopics] = useState(doc.tags.join(', '));
  const [text, setText] = useState(doc.text);
  const [editing, setEditing] = useState(false);
  const [processed, setProcessed] = useState(false);
  const action = useAction();
  const editable = doc.permission !== 'view';
  return (
    <>
      <div className="flex flex-wrap gap-4 text-sm">
        <span>
          {date(doc.createdAt)} · {doc.sourceType} · {doc.permission}
        </span>
        <Link className="underline" to="/library">
          Back to library
        </Link>
        <Link className="underline" to={`/tasks?sourceId=${key(doc.id)}`}>
          Linked tasks
        </Link>
        <Link className="underline" to={`/assistant?documentId=${key(doc.id)}`}>
          Ask about this document
        </Link>
        {doc.meetingId && (
          <Link className="underline" to={`/meetings/${key(doc.meetingId)}`}>
            Meeting
          </Link>
        )}
      </div>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-4 text-xl font-bold">Source document</h2>
          {doc.processed && (
            <label className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={processed}
                onChange={(e) => setProcessed(e.target.checked)}
              />
              Show preprocessed image
            </label>
          )}
          <SourceViewer
            key={processed ? 'processed' : 'original'}
            file={processed ? doc.processed : doc.original}
          />
        </Panel>
        <Panel>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">Text and metadata</h2>
            {editable && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing((v) => !v);
                  action.clear();
                }}
              >
                {editing ? 'Cancel editing' : 'Edit document'}
              </Button>
            )}
          </div>
          {editing ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim()) return;
                void action.run(
                  (signal) =>
                    request<DocumentRecord>(`/documents/${key(doc.id)}`, {
                      ...json('PATCH', {
                        title: title.trim(),
                        documentType: type.trim(),
                        tags: tags(topics),
                        text,
                      }),
                      signal,
                    }),
                  () => {
                    setEditing(false);
                    reload();
                  },
                  'Document saved.',
                );
              }}
            >
              <Field id="doc-title" label="Title">
                <input
                  id="doc-title"
                  className={fieldClass}
                  required
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Field>
              <Field id="doc-type" label="Document type">
                <input
                  id="doc-type"
                  className={fieldClass}
                  maxLength={80}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                />
              </Field>
              <Field id="doc-topics" label="Topics (comma separated)">
                <input
                  id="doc-topics"
                  className={fieldClass}
                  maxLength={500}
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                />
              </Field>
              <Field id="doc-text" label="Extracted text">
                <textarea
                  id="doc-text"
                  className={fieldClass}
                  rows={12}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
              <Button type="submit" disabled={action.pending}>
                Save corrections
              </Button>
            </form>
          ) : (
            <>
              <p className="mb-3">Type: {doc.documentType || 'Not classified'}</p>
              <div className="mb-5 flex flex-wrap gap-2">
                {doc.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-primary/10 px-3 py-1 text-sm">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="max-h-[60dvh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-white/60 p-4">
                {doc.text || 'Extracted text is not available yet. Check the processing status.'}
              </div>
            </>
          )}
          <ErrorNotice error={action.error} />
          <Notice>{action.message}</Notice>
        </Panel>
      </div>
      {doc.summary && (
        <Panel>
          <h2 className="mb-3 text-xl font-bold">Summary</h2>
          <p className="whitespace-pre-wrap break-words">{doc.summary}</p>
        </Panel>
      )}
      {doc.permission === 'owner' && <DocumentShares documentId={doc.id} />}
    </>
  );
}
export function DocumentDetail() {
  const { id = '' } = useParams();
  const result = useResource<DocumentRecord>(`/documents/${key(id)}`);
  return (
    <Page title={result.data?.title || 'Document'}>
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <Loading />}
      {result.data && (
        <DocumentContent
          key={`${result.data.id}-${result.data.title}-${result.data.text}`}
          doc={result.data}
          reload={result.reload}
        />
      )}
    </Page>
  );
}
