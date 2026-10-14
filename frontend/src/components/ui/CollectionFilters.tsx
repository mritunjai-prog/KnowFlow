import { useResource } from '../../api/hooks';
import type { Capabilities } from '../../api/types';
import { Field, fieldClass } from './Feedback';
export function CollectionFilters({
  params,
  set,
}: {
  params: URLSearchParams;
  set: (name: string, value: string) => void;
}) {
  const caps = useResource<Capabilities>('/capabilities');
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Field id="search" label="Search">
        <input
          id="search"
          type="search"
          className={fieldClass}
          value={params.get('q') || ''}
          onChange={(e) => set('q', e.target.value)}
        />
      </Field>
      <Field id="topic" label="Topic">
        <input
          id="topic"
          list="known-topics"
          className={fieldClass}
          value={params.get('topic') || ''}
          onChange={(e) => set('topic', e.target.value)}
        />
        <datalist id="known-topics">
          {caps.data?.topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field id="type" label="Document type">
        <input
          id="type"
          list="known-types"
          className={fieldClass}
          value={params.get('type') || ''}
          onChange={(e) => set('type', e.target.value)}
        />
        <datalist id="known-types">
          {caps.data?.documentTypes.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </Field>
      <Field id="from" label="From date">
        <input
          id="from"
          type="date"
          className={fieldClass}
          max={params.get('to') || undefined}
          value={params.get('from') || ''}
          onChange={(e) => set('from', e.target.value)}
        />
      </Field>
      <Field id="to" label="To date">
        <input
          id="to"
          type="date"
          className={fieldClass}
          min={params.get('from') || undefined}
          value={params.get('to') || ''}
          onChange={(e) => set('to', e.target.value)}
        />
      </Field>
    </div>
  );
}
