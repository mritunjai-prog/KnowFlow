import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useResource } from '../api/hooks';
import type { DocumentRecord, Page as PageData } from '../api/types';
import { key, safeUrl } from '../api/client';
import {
  Page,
  Panel,
  Loading,
  ErrorNotice,
  Empty,
  Pager,
  Field,
  fieldClass,
} from '../components/ui/Feedback';
import { CollectionFilters } from '../components/ui/CollectionFilters';
import { useFilters } from '../hooks/useFilters';
import { date } from '../lib/utils';
export function Library() {
  const filters = useFilters();
  const search = new URLSearchParams(filters.params);
  search.set('page', String(filters.page));
  const result = useResource<PageData<DocumentRecord>>(`/documents?${search}`);
  return (
    <Page
      title="Document library"
      description="Find your documents and those explicitly shared with you."
      actions={
        <Link to="/capture" className="rounded-xl bg-secondary px-4 py-3 font-semibold text-white">
          Capture knowledge
        </Link>
      }
    >
      <Panel>
        <CollectionFilters {...filters} />
        <div className="mt-4 max-w-xs">
          <Field id="ownership" label="Show">
            <select
              id="ownership"
              className={fieldClass}
              value={filters.params.get('ownership') || 'all'}
              onChange={(e) => filters.set('ownership', e.target.value)}
            >
              <option value="all">Owned and shared documents</option>
              <option value="owned">My documents</option>
              <option value="shared">Shared with me</option>
            </select>
          </Field>
        </div>
      </Panel>
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <Loading />}
      {result.data && (
        <>
          {!result.data.items.length ? (
            <Empty>
              No documents match these filters. Capture a document or adjust your search.
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {result.data.items.map((doc) => (
                <Link
                  key={doc.id}
                  to={`/document/${key(doc.id)}`}
                  className="group rounded-2xl border border-primary/20 bg-sand/90 p-5 shadow-sm transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-secondary"
                >
                  <div className="mb-4 flex h-32 items-center justify-center overflow-hidden rounded-lg bg-white/70">
                    {safeUrl(doc.thumbnailUrl) ? (
                      <img
                        src={safeUrl(doc.thumbnailUrl)}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <FileText aria-hidden="true" className="h-12 w-12 text-primary/60" />
                    )}
                  </div>
                  <h2 className="break-words font-heading text-xl font-bold group-hover:text-secondary">
                    {doc.title}
                  </h2>
                  <p className="mt-2 text-sm">
                    {doc.documentType || 'Not classified'} · {date(doc.createdAt)}
                  </p>
                  <p className="mt-3 break-words text-sm">
                    {doc.tags.join(' · ') || 'No topics yet'}
                  </p>
                  <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs">
                    {doc.permission === 'owner' ? 'Owned by you' : `Shared · ${doc.permission}`}
                  </span>
                </Link>
              ))}
            </div>
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
