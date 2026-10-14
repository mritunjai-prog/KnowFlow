import { Link } from 'react-router-dom';
import { useResource } from '../api/hooks';
import { key } from '../api/client';
import type { TimelineEvent, Page as PageData } from '../api/types';
import { Page, Panel, ErrorNotice, Loading, Empty, Pager } from '../components/ui/Feedback';
import { CollectionFilters } from '../components/ui/CollectionFilters';
import { useFilters } from '../hooks/useFilters';
import { date } from '../lib/utils';
export function Timeline() {
  const filters = useFilters();
  const params = new URLSearchParams(filters.params);
  params.set('page', String(filters.page));
  params.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
  const result = useResource<PageData<TimelineEvent>>(`/timeline?${params}`);
  const groups = new Map<string, TimelineEvent[]>();
  for (const item of result.data?.items || []) {
    const day = date(item.occurredAt);
    groups.set(day, [...(groups.get(day) || []), item]);
  }
  return (
    <Page
      title="Timeline"
      description="Your captured knowledge and activity, grouped in your local timezone."
    >
      <Panel>
        <CollectionFilters {...filters} />
      </Panel>
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <Loading />}
      {result.data && (
        <>
          {!result.data.items.length ? (
            <Empty>No activity matches your filters.</Empty>
          ) : (
            [...groups].map(([day, events]) => (
              <section key={day}>
                <h2 className="mb-3 text-xl font-bold">{day}</h2>
                <ol className="ml-2 space-y-4 border-l-2 border-primary/25 pl-5">
                  {events.map((event) => (
                    <li key={event.id}>
                      <Panel>
                        <div className="flex flex-wrap justify-between gap-3">
                          <h3 className="font-semibold">{event.title}</h3>
                          <time dateTime={event.occurredAt} className="text-sm">
                            {new Date(event.occurredAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                        <p className="my-2 text-sm">{event.type}</p>
                        {event.source && (
                          <Link
                            className="underline"
                            to={`/document/${key(event.source.documentId)}`}
                          >
                            {event.source.title}
                          </Link>
                        )}
                        {event.meetingId && (
                          <Link className="ml-3 underline" to={`/meetings/${key(event.meetingId)}`}>
                            Meeting
                          </Link>
                        )}
                      </Panel>
                    </li>
                  ))}
                </ol>
              </section>
            ))
          )}
          <Pager
            page={result.data.page}
            total={result.data.total}
            pageSize={result.data.pageSize}
            onChange={(p) => filters.set('page', String(p))}
          />
        </>
      )}
    </Page>
  );
}
