import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useResource } from '../api/hooks';
import type { Analytics } from '../api/types';
import {
  Page,
  Panel,
  Loading,
  ErrorNotice,
  Empty,
  Field,
  fieldClass,
} from '../components/ui/Feedback';
import { CountUp } from '../components/ui/CountUp';
import { useFilters } from '../hooks/useFilters';
import { useAuth } from '../auth/context';
export function Dashboard() {
  const filters = useFilters();
  const days = ['7', '30', '90'].includes(filters.params.get('days') || '')
    ? filters.params.get('days')!
    : '7';
  const result = useResource<Analytics>(`/analytics?days=${days}`);
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
