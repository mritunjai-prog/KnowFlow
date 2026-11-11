import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAction, useResource } from '../api/hooks';
import { json, key, query, request } from '../api/client';
import type { Analytics, StudySessionState } from '../api/types';
import {
  Page,
  Panel,
  Loading,
  ErrorNotice,
  Empty,
  Field,
  fieldClass,
  Notice,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { CountUp } from '../components/ui/CountUp';
import { useFilters } from '../hooks/useFilters';
import { useAuth } from '../auth/context';

function browserZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function StudyTimer() {
  const [params] = useSearchParams();
  const documentId = params.get('documentId');
  const action = useAction();
  const [tick, setTick] = useState(0);
  const current = useResource<StudySessionState>('/study-sessions/current');
  const session = current.data?.session ?? null;
  const open = session && session.status !== 'completed' ? session : null;
  const revision = useRef(open?.revision);
  revision.current = open?.revision;
  useEffect(() => {
    if (open?.status !== 'active') return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [open?.status, open?.id]);
  useEffect(() => {
    if (open?.status !== 'active') return;
    const beat = setInterval(() => {
      const presented = revision.current;
      if (!presented) return;
      void request<StudySessionState>(`/study-sessions/${key(open.id)}/heartbeat`, {
        ...json('POST', { revision: presented }),
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      })
        .then(() => current.reload())
        .catch(() => current.reload());
    }, 30000);
    return () => clearInterval(beat);
  }, [open?.status, open?.id, current]);
  const elapsed = (() => {
    if (!open) return 0;
    if (open.status !== 'active') return open.measuredSeconds;
    const confirmed = Date.parse(open.confirmedThrough);
    const server = Date.parse(current.data?.serverTime || '');
    if (!Number.isFinite(confirmed) || !Number.isFinite(server)) return open.measuredSeconds;
    const skew = Date.now() - server;
    const projected = open.measuredSeconds + Math.max(0, (Date.now() - skew - confirmed) / 1000);
    return Math.max(open.measuredSeconds, Math.floor(Math.min(projected, open.measuredSeconds + 90)));
  })();
  void tick;
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const mutate = (
    path: string,
    body: unknown,
    notice: string,
  ) => {
    void action.run(
      (signal) =>
        request<StudySessionState>(path, {
          ...json('POST', body),
          signal,
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      () => current.reload(),
      notice,
    );
  };
  return (
    <Panel>
      <h2 className="text-xl font-bold">Recorded study time</h2>
      <p className="mt-2 text-sm">
        This is a timer you start. It is not attention, learning, or mastery. Only seconds
        confirmed by the server are recorded. A missed heartbeat pauses at the last confirmation
        and does not credit the gap.
      </p>
      <p className="my-4 font-heading text-4xl font-bold" aria-live="polite">
        {open ? clock : '00:00'}
      </p>
      <p className="text-sm">
        {open
          ? `${open.status === 'active' ? 'Recording' : 'Paused'}. Confirmed ${open.measuredSeconds} seconds.`
          : 'No open study session.'}
        {open?.pauseReason === 'connection_lost' ? ' The connection was lost, so the gap was not counted.' : ''}
        {open?.documentId ? ' Linked to the selected document.' : ''}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {!open && (
          <Button
            disabled={action.pending || current.loading}
            onClick={() =>
              mutate(
                '/study-sessions',
                documentId ? { documentId } : {},
                'Study session started. Only confirmed seconds will count.',
              )
            }
          >
            Start
          </Button>
        )}
        {open?.status === 'active' && (
          <Button
            variant="secondary"
            disabled={action.pending}
            onClick={() =>
              mutate(
                `/study-sessions/${key(open.id)}/pause`,
                { revision: open.revision },
                'Paused at the last server confirmation.',
              )
            }
          >
            Pause
          </Button>
        )}
        {open?.status === 'paused' && (
          <Button
            disabled={action.pending}
            onClick={() =>
              mutate(
                `/study-sessions/${key(open.id)}/resume`,
                { revision: open.revision },
                'Resumed. The paused gap is not counted.',
              )
            }
          >
            Resume
          </Button>
        )}
        {open && (
          <Button
            variant="secondary"
            disabled={action.pending}
            onClick={() =>
              mutate(
                `/study-sessions/${key(open.id)}/stop`,
                { revision: open.revision },
                'Study session stopped.',
              )
            }
          >
            Stop
          </Button>
        )}
      </div>
      <ErrorNotice error={current.error} retry={current.reload} />
      <ErrorNotice error={action.error} />
      {action.message && <Notice>{action.message}</Notice>}
    </Panel>
  );
}

export function Dashboard() {
  const filters = useFilters();
  const days = ['7', '30', '90'].includes(filters.params.get('days') || '')
    ? filters.params.get('days')!
    : '7';
  const zone = browserZone();
  const result = useResource<Analytics>(`/analytics${query({ days, timezone: zone })}`);
  const auth = useAuth();
  return (
    <Page
      title="Your knowledge hub"
      description="A personal overview of your library, topics and follow-through."
      actions={
        <Link to="/capture" className="rounded-xl bg-secondary px-4 py-3 font-semibold text-white">
          Capture knowledge
        </Link>
      }
    >
      {!auth.user?.onboardingComplete && (
        <Panel>
          <h2 className="font-bold">New here?</h2>
          <Link className="underline" to="/onboarding">
            Follow the first capture and question guide
          </Link>
        </Panel>
      )}
      <div className="max-w-xs">
        <Field id="period" label="Analytics period">
          <select
            id="period"
            className={fieldClass}
            value={days}
            onChange={(e) => filters.set('days', e.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </Field>
      </div>
      <StudyTimer />
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <Loading />}
      {result.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Documents in your library',
                value: result.data.documentCount,
                to: '/library',
              },
              {
                label: 'Pending tasks',
                value: result.data.pendingTaskCount,
                to: '/tasks?status=pending',
              },
              {
                label: 'Completed tasks',
                value: result.data.completedTaskCount,
                to: '/tasks?status=completed',
              },
            ].map((stat) => (
              <Panel key={stat.label}>
                <h2 className="text-sm">{stat.label}</h2>
                <p className="my-3 font-heading text-4xl font-bold">
                  <CountUp to={stat.value} />
                </p>
                <Link className="underline" to={stat.to}>
                  View
                </Link>
              </Panel>
            ))}
            <Panel>
              <h2 className="text-sm">Study time (minutes)</h2>
              <p className="my-3 text-3xl font-bold">
                {result.data.studyMinutes ?? 'Not measured'}
              </p>
              <p className="text-sm">{result.data.studyTimeDefinition}</p>
            </Panel>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Panel className="min-w-0 lg:col-span-2">
              <h2 className="mb-4 text-xl font-bold">Productivity activity</h2>
              {result.data.activity.length ? (
                <>
                  <div
                    className="h-64 min-w-0"
                    role="img"
                    aria-label="Daily documents captured and tasks completed. Exact values follow in the data table."
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.data.activity}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="documents"
                          name="Documents"
                          stroke="#244855"
                          fill="#90aead"
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="completedTasks"
                          name="Completed tasks"
                          stroke="#b62515"
                          fill="#e64833"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <details className="mt-4">
                    <summary className="cursor-pointer font-semibold">View chart data</summary>
                    <div className="overflow-x-auto">
                      <table className="mt-3 w-full text-left text-sm">
                        <caption className="sr-only">Daily productivity</caption>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            <th scope="col">Documents</th>
                            <th scope="col">Completed tasks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.data.activity.map((day) => (
                            <tr key={day.date}>
                              <th scope="row" className="py-2">
                                {day.date}
                              </th>
                              <td>{day.documents}</td>
                              <td>{day.completedTasks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </>
              ) : (
                <Empty>No activity recorded for this period.</Empty>
              )}
            </Panel>
            <Panel>
              <h2 className="mb-4 text-xl font-bold">Topic coverage</h2>
              <p className="mb-4 text-sm">
                Number of accessible documents tagged with each topic. This is not a measure of
                mastery.
              </p>
              {result.data.topicCoverage.length ? (
                <ul className="space-y-3">
                  {result.data.topicCoverage.map((topic) => (
                    <li key={topic.topic} className="flex justify-between gap-3">
                      <Link
                        className="break-words underline"
                        to={`/library?topic=${encodeURIComponent(topic.topic)}`}
                      >
                        {topic.topic}
                      </Link>
                      <span>{topic.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No classified topics yet.</p>
              )}
            </Panel>
          </div>
        </>
      )}
    </Page>
  );
}
