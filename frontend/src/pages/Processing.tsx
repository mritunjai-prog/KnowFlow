import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAction, useResource } from '../api/hooks';
import { json, key, request } from '../api/client';
import type { Job } from '../api/types';
import { Page, Panel, Loading, ErrorNotice, Notice } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
export function Processing() {
  const { id = '' } = useParams();
  const [poll, setPoll] = useState(true);
  const job = useResource<Job>(`/jobs/${key(id)}`, poll);
  const action = useAction();
  useEffect(() => {
    setPoll(true);
  }, [id]);
  useEffect(() => {
    if (job.data && ['succeeded', 'failed', 'cancelled'].includes(job.data.status)) setPoll(false);
  }, [job.data]);
  return (
    <Page
      title="Processing status"
      description="Processing runs on the backend. You can leave this page and return using this address."
    >
      <ErrorNotice error={job.error} retry={job.reload} />
      {job.loading && <Loading />}
      {job.data && (
        <Panel>
          <h2 className="text-xl font-bold capitalize">{job.data.status}</h2>
          <Notice>{job.data.stage}</Notice>
          <progress
            aria-label="Processing progress"
            className="my-4 h-3 w-full"
            max={100}
            value={Math.max(0, Math.min(100, job.data.progress))}
          />
          <ErrorNotice error={job.data.error ? new Error(job.data.error) : null} />
          <ul className="space-y-3">
            {job.data.items.map((item, i) => (
              <li key={`${item.name}-${i}`} className="rounded-lg border border-primary/20 p-3">
                <p className="break-words font-semibold">
                  {item.name} · {item.status}
                </p>
                {item.error && <p className="text-secondary">{item.error}</p>}
                {item.documentId && (
                  <Link className="underline" to={`/document/${key(item.documentId)}`}>
                    Review extracted document
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-3">
            {job.data.retryable && (
              <Button
                disabled={action.pending}
                onClick={() =>
                  void action.run(
                    (signal) => request<Job>(`/jobs/${key(id)}/retry`, { ...json('POST'), signal }),
                    () => {
                      setPoll(true);
                      job.reload();
                    },
                  )
                }
              >
                Retry failed items
              </Button>
            )}
            {['queued', 'running'].includes(job.data.status) && (
              <Button
                disabled={action.pending}
                variant="secondary"
                onClick={() =>
                  void action.run(
                    (signal) =>
                      request<Job>(`/jobs/${key(id)}/cancel`, { ...json('POST'), signal }),
                    job.reload,
                  )
                }
              >
                Cancel processing
              </Button>
            )}
            {job.data.meetingId && (
              <Link className="underline" to={`/meetings/${key(job.data.meetingId)}`}>
                Open meeting
              </Link>
            )}
            <Link className="underline" to="/library">
              Open library
            </Link>
          </div>
        </Panel>
      )}
      <ErrorNotice error={action.error} />
    </Page>
  );
}
