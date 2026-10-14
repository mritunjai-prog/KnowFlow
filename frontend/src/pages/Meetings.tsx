import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAction, useResource } from '../api/hooks';
import { json, key, request, query } from '../api/client';
import type { Meeting, Job, Page as PageData } from '../api/types';
import {
  Page,
  Panel,
  ErrorNotice,
  Loading,
  Empty,
  Field,
  fieldClass,
  Pager,
  Dialog,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { useFilters } from '../hooks/useFilters';
import { date } from '../lib/utils';
export function Meetings() {
  const filters = useFilters();
  const list = useResource<PageData<Meeting>>(
    `/meetings${query({ q: filters.params.get('q') || '', page: filters.page })}`,
  );
  const action = useAction();
  const navigate = useNavigate();
  const [create, setCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState('');
  return (
    <Page
      title="Meetings"
      description="Keep a session’s images, transcripts, decisions and tasks together."
      actions={<Button onClick={() => setCreate(true)}>New meeting</Button>}
    >
      <Field id="meeting-search" label="Search meetings">
        <input
          id="meeting-search"
          type="search"
          className={fieldClass}
          value={filters.params.get('q') || ''}
          onChange={(e) => filters.set('q', e.target.value)}
        />
      </Field>
      <ErrorNotice error={list.error} retry={list.reload} />
      {list.loading && <Loading />}
      {list.data && (
        <>
          {!list.data.items.length ? (
            <Empty>No meetings yet. Create a session or label your next batch of captures.</Empty>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {list.data.items.map((meeting) => (
                <li key={meeting.id}>
                  <Panel>
                    <Link
                      className="text-xl font-semibold underline"
                      to={`/meetings/${key(meeting.id)}`}
                    >
                      {meeting.title}
                    </Link>
                    <p className="mt-3">{date(meeting.occurredAt)}</p>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
          <Pager
            page={list.data.page}
            total={list.data.total}
            pageSize={list.data.pageSize}
            onChange={(p) => filters.set('page', String(p))}
          />
        </>
      )}
      {create && (
        <Dialog title="New meeting" onClose={() => setCreate(false)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim()) return;
              void action.run(
                (signal) =>
                  request<Meeting>('/meetings', {
                    ...json('POST', {
                      title: title.trim(),
                      occurredAt: new Date(when).toISOString(),
                    }),
                    signal,
                  }),
                (meeting) => navigate(`/meetings/${key(meeting.id)}`),
              );
            }}
          >
            <Field id="meeting-title" label="Meeting title">
              <input
                id="meeting-title"
                className={fieldClass}
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>
            <Field id="meeting-date" label="Date and time">
              <input
                id="meeting-date"
                className={fieldClass}
                type="datetime-local"
                required
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </Field>
            <ErrorNotice error={action.error} />
            <Button type="submit" disabled={action.pending}>
              Create meeting
            </Button>
          </form>
        </Dialog>
      )}
    </Page>
  );
}
export function MeetingDetail() {
  const { id = '' } = useParams();
  const result = useResource<Meeting>(`/meetings/${key(id)}`);
  const action = useAction();
  const navigate = useNavigate();
  return (
    <Page
      title={result.data?.title || 'Meeting'}
      actions={
        <Link className="underline" to="/meetings">
          All meetings
        </Link>
      }
    >
      <ErrorNotice error={result.error} retry={result.reload} />
      <ErrorNotice error={action.error} />
      {result.loading && <Loading />}
      {result.data && (
        <>
          <p>{date(result.data.occurredAt)}</p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/capture?meetingId=${key(id)}`}
              className="rounded-xl bg-secondary px-4 py-3 font-semibold text-white"
            >
              Add images, audio or documents
            </Link>
            <Button
              variant="secondary"
              disabled={action.pending || !result.data.documents.length}
              onClick={() =>
                void action.run(
                  (signal) =>
                    request<Job>(`/meetings/${key(id)}/summarize`, { ...json('POST'), signal }),
                  (job) => navigate(`/processing/${key(job.id)}`),
                )
              }
            >
              Generate summary and decisions
            </Button>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <h2 className="mb-3 text-xl font-bold">Summary</h2>
              <p className="whitespace-pre-wrap break-words">
                {result.data.summary ||
                  'No summary yet. Add processed content, then generate a summary.'}
              </p>
              <h3 className="mb-3 mt-6 font-bold">Decisions</h3>
              {result.data.decisions.length ? (
                <ul className="list-inside list-disc space-y-2">
                  {result.data.decisions.map((decision, i) => (
                    <li key={i}>{decision}</li>
                  ))}
                </ul>
              ) : (
                <p>No decisions extracted yet.</p>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-3 text-xl font-bold">Source artifacts</h2>
              <ul className="space-y-3">
                {result.data.documents.map((doc) => (
                  <li key={doc.id}>
                    <Link className="underline" to={`/document/${key(doc.id)}`}>
                      {doc.title}
                    </Link>
                    <span className="ml-2 text-sm">{doc.sourceType}</span>
                  </li>
                ))}
              </ul>
              {!result.data.documents.length && <p>No artifacts attached.</p>}
              <h3 className="mb-3 mt-6 font-bold">Linked tasks</h3>
              <ul className="space-y-3">
                {result.data.tasks.map((task) => (
                  <li key={task.id}>
                    <Link
                      className="underline"
                      to={`/tasks?sourceId=${key(task.source.documentId)}`}
                    >
                      {task.description}
                    </Link>{' '}
                    · {task.status}
                  </li>
                ))}
              </ul>
              {!result.data.tasks.length && <p>No tasks extracted yet.</p>}
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}
