import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAction, useResource } from '../api/hooks';
import { request, key } from '../api/client';
import type { Answer, Capabilities, Conversation, Message, Page as PageData } from '../api/types';
import {
  Page,
  Panel,
  Loading,
  ErrorNotice,
  Field,
  fieldClass,
  Notice,
  Empty,
  Pager,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
function MessageView({ message }: { message: Message }) {
  return (
    <article
      className={`rounded-2xl border border-primary/15 p-4 sm:p-5 ${message.role === 'user' ? 'ml-4 bg-white/80' : 'mr-4 bg-sand/95'}`}
    >
      <h2 className="mb-2 text-sm font-bold">{message.role === 'user' ? 'You' : 'KnowFlow'}</h2>
      <p className="whitespace-pre-wrap break-words">{message.text}</p>
      {message.insufficientEvidence && (
        <p className="mt-3 font-semibold text-secondary">
          There is not enough evidence in the available sources to answer reliably.
        </p>
      )}
      {message.sources.length > 0 && (
        <section className="mt-4 border-t border-primary/20 pt-3">
          <h3 className="font-semibold">Sources</h3>
          <ol className="mt-2 list-inside list-decimal space-y-3">
            {message.sources.map((source, i) => (
              <li key={`${source.documentId}-${i}`}>
                <Link
                  className="underline"
                  to={`/document/${key(source.documentId)}${source.page ? `?page=${source.page}` : ''}`}
                >
                  {source.title}
                  {source.page ? ` · page ${source.page}` : ''}
                </Link>
                {source.excerpt && (
                  <blockquote className="mt-1 border-l-2 border-primary/30 pl-3 text-sm">
                    {source.excerpt}
                  </blockquote>
                )}
                {source.region && (
                  <p className="text-sm">
                    Image region (normalized x, y, width, height): {source.region.join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}
export function Assistant() {
  const [params, setParams] = useSearchParams();
  const conversationId = params.get('conversationId');
  const documentId = params.get('documentId');
  const [historyPage, setHistoryPage] = useState(1);
  const history = useResource<PageData<Conversation>>(
    `/conversations?page=${historyPage}&pageSize=20`,
  );
  const selected = useResource<Conversation>(
    conversationId ? `/conversations/${key(conversationId)}` : null,
  );
  const caps = useResource<Capabilities>('/capabilities');
  const action = useAction();
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const keyRef = useRef<string | null>(null);
  useEffect(() => {
    setMessages([]);
    keyRef.current = null;
  }, [conversationId]);
  useEffect(() => {
    keyRef.current = null;
  }, [documentId]);
  useEffect(() => {
    if (selected.data) setMessages(selected.data.messages);
  }, [selected.data]);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'nearest', behavior: 'instant' });
  }, [messages.length, action.pending]);
  const send = () => {
    if (!input.trim() || action.pending) return;
    setError(null);
    if (!caps.data) {
      setError(new Error('Model capabilities are not available. Retry loading the service.'));
      return;
    }
    if (input.length > caps.data.maxTextCharacters) {
      setError(new Error('Your question exceeds the configured text limit.'));
      return;
    }
    const data = new FormData();
    data.append('query', input.trim());
    data.append(
      'context',
      JSON.stringify({
        conversationId,
        documentIds: params.get('documentId') ? [params.get('documentId')] : [],
      }),
    );
    if (image) data.append('image', image);
    keyRef.current ||= crypto.randomUUID();
    void action.run(
      (signal) =>
        request<Answer>('/assistant/query', {
          method: 'POST',
          body: data,
          signal,
          headers: { 'Idempotency-Key': keyRef.current! },
        }),
      (response) => {
        setMessages((previous) => [...previous, response.userMessage, response.answer]);
        setInput('');
        setImage(null);
        keyRef.current = null;
        if (conversationId !== response.conversationId)
          setParams((previous) => {
            const next = new URLSearchParams(previous);
            next.set('conversationId', response.conversationId);
            return next;
          });
        else selected.reload();
        history.reload();
      },
    );
  };
  return (
    <Page
      title="Ask your knowledge"
      description="Answers should be grounded in documents you can access. Check the cited sources."
    >
      <Panel>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end">
          <div className="w-full min-w-0 flex-1">
            <Field id="conversation" label="Conversation">
              <select
                id="conversation"
                className={fieldClass}
                value={conversationId || ''}
                disabled={action.pending}
                onChange={(e) => {
                  action.clear();
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    if (e.target.value) next.set('conversationId', e.target.value);
                    else next.delete('conversationId');
                    return next;
                  });
                }}
              >
                <option value="">New conversation</option>
                {conversationId && !history.data?.items.some((c) => c.id === conversationId) && (
                  <option value={conversationId}>Current conversation</option>
                )}
                {history.data?.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            variant="secondary"
            disabled={action.pending}
            onClick={() => {
              setParams((previous) => {
                const next = new URLSearchParams(previous);
                next.delete('conversationId');
                return next;
              });
              setMessages([]);
              setInput('');
              setImage(null);
              keyRef.current = null;
              action.clear();
            }}
          >
            New conversation
          </Button>
        </div>
        <ErrorNotice error={history.error} retry={history.reload} />
        {history.loading && <Loading label="Loading conversations…" />}
        {history.data && (
          <Pager
            page={history.data.page}
            total={history.data.total}
            pageSize={history.data.pageSize}
            onChange={setHistoryPage}
          />
        )}
        {params.get('documentId') && (
          <p className="mt-3 text-sm">
            Context limited to{' '}
            <Link className="underline" to={`/document/${key(params.get('documentId')!)}`}>
              the selected document
            </Link>
            .{' '}
            <Button
              variant="ghost"
              disabled={action.pending}
              onClick={() =>
                setParams((previous) => {
                  const next = new URLSearchParams(previous);
                  next.delete('documentId');
                  return next;
                })
              }
            >
              Use all accessible documents
            </Button>
          </p>
        )}
      </Panel>
      <ErrorNotice error={selected.error} retry={selected.reload} />
      <ErrorNotice error={caps.error} retry={caps.reload} />
      {selected.loading && <Loading />}
      <section
        aria-label="Conversation messages"
        className="max-h-[55dvh] space-y-4 overflow-y-auto"
      >
        {!selected.loading && !messages.length && (
          <Empty>
            Ask your first question. Add documents to your library if you have not captured anything
            yet.
          </Empty>
        )}
        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}
        <div ref={end} />
      </section>
      <Notice>
        {action.pending
          ? 'Retrieving evidence and preparing an answer…'
          : messages.at(-1)?.role === 'assistant'
            ? 'Answer ready. Review its sources in the conversation.'
            : ''}
      </Notice>
      <Panel>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <Field id="question" label="Your question">
            <textarea
              id="question"
              required
              rows={3}
              className={fieldClass}
              value={input}
              maxLength={caps.data?.maxTextCharacters}
              onChange={(e) => {
                setInput(e.target.value);
                keyRef.current = null;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={action.pending}
            />
          </Field>
          <Field
            id="query-image"
            label="Image context for multimodal retrieval"
            hint="Attach an image for visual evidence. This requires configured multimodal models on the backend."
          >
            <input
              id="query-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!caps.data?.multimodal || action.pending}
              aria-describedby="query-image-hint"
              className="w-full max-w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                keyRef.current = null;
                if (
                  file &&
                  (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                    file.size > (caps.data?.maxFileBytes || 0))
                ) {
                  setError(new Error('Choose a supported image within the upload limit.'));
                  return;
                }
                setImage(file || null);
                setError(null);
              }}
            />
          </Field>
          {image && (
            <p className="break-all text-sm">
              Attached: {image.name}{' '}
              <Button
                variant="ghost"
                disabled={action.pending}
                onClick={() => {
                  setImage(null);
                  keyRef.current = null;
                }}
              >
                Remove image
              </Button>
            </p>
          )}
          {caps.data && !caps.data.multimodal && (
            <Notice>
              Multimodal retrieval is not configured on the server. Text questions remain available.
            </Notice>
          )}
          <ErrorNotice error={error || action.error} />
          <Button
            type="submit"
            disabled={
              !input.trim() || action.pending || !caps.data || selected.loading || !!selected.error
            }
          >
            {action.pending ? 'Waiting for answer…' : 'Send question'}
          </Button>
        </form>
      </Panel>
    </Page>
  );
}
