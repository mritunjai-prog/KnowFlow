import { useState } from 'react';
import { useResource, useAction } from '../api/hooks';
import { json, request } from '../api/client';
import type { AdminConfig, AdminStatus, Capabilities } from '../api/types';
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
import { bytes } from '../lib/utils';
function Configuration({
  config,
  caps,
  reload,
}: {
  config: AdminConfig;
  caps: Capabilities;
  reload: () => void;
}) {
  const [limit, setLimit] = useState(String(config.storageLimitBytes));
  const [model, setModel] = useState(config.defaultModelId || '');
  const [sources, setSources] = useState(config.captureSources);
  const action = useAction();
  return (
    <Panel>
      <h2 className="mb-4 text-xl font-bold">System configuration</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const storageLimitBytes = Number(limit);
          if (!Number.isSafeInteger(storageLimitBytes) || storageLimitBytes <= 0) return;
          void action.run(
            (signal) =>
              request<AdminConfig>('/admin/config', {
                ...json('PATCH', {
                  storageLimitBytes,
                  defaultModelId: model || null,
                  captureSources: sources,
                }),
                signal,
              }),
            reload,
            'Configuration saved.',
          );
        }}
      >
        <Field id="storage-limit" label="Per-account storage limit (bytes)">
          <input
            id="storage-limit"
            type="number"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            required
            className={fieldClass}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
        <Field id="default-model" label="Default answer model">
          <select
            id="default-model"
            className={fieldClass}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="">Not configured</option>
            {caps.models.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.available}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="space-y-2">
          <legend className="mb-2 font-semibold">Enabled capture sources</legend>
          {['file', 'camera', 'text', 'audio'].map((source) => (
            <label key={source} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sources.includes(source)}
                onChange={(e) =>
                  setSources((v) =>
                    e.target.checked ? [...v, source] : v.filter((s) => s !== source),
                  )
                }
              />
              {source}
            </label>
          ))}
        </fieldset>
        <ErrorNotice error={action.error} />
        <Notice>{action.message}</Notice>
        <Button type="submit" disabled={action.pending}>
          Save configuration
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Changes require server-side Admin authorization. Configure provider adapters and credentials
        through Render environment variables, not this panel. Changing embedding models requires a
        compatible index/reindex operation on the backend.
      </p>
    </Panel>
  );
}
export function Admin() {
  const config = useResource<AdminConfig>('/admin/config');
  const status = useResource<AdminStatus>('/admin/status');
  const caps = useResource<Capabilities>('/capabilities');
  return (
    <Page
      title="Administration"
      description="Configuration, storage limits and processing health for KnowFlow."
      actions={
        <Button variant="secondary" onClick={status.reload}>
          Refresh status
        </Button>
      }
    >
      <ErrorNotice error={status.error} retry={status.reload} />
      <ErrorNotice error={config.error} retry={config.reload} />
      <ErrorNotice error={caps.error} retry={caps.reload} />
      {(status.loading || config.loading || caps.loading) && <Loading />}
      {status.data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Stored data', bytes(status.data.storageUsedBytes)],
              ['Documents', status.data.documentCount],
              ['Queued jobs', status.data.queuedJobs],
              ['Failed jobs', status.data.failedJobs],
            ].map(([label, value]) => (
              <Panel key={label}>
                <h2 className="text-sm">{label}</h2>
                <p className="mt-2 text-2xl font-bold">{value}</p>
              </Panel>
            ))}
          </div>
          <Panel>
            <h2 className="mb-4 text-xl font-bold">Service health</h2>
            <ul className="space-y-4">
              {status.data.services.map((service) => (
                <li key={service.name}>
                  <h3 className="font-semibold">
                    {service.name} · {service.status}
                  </h3>
                  <p className="text-sm">{service.message}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
      {config.data && caps.data && (
        <Configuration
          key={JSON.stringify(config.data)}
          config={config.data}
          caps={caps.data}
          reload={config.reload}
        />
      )}
    </Page>
  );
}
