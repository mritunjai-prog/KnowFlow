import { useState } from 'react';
import { useResource, useAction } from '../api/hooks';
import { json, request } from '../api/client';
import type { Capabilities, Settings as Preferences } from '../api/types';
import { useAuth } from '../auth/context';
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
function SettingsForm({
  settings,
  capabilities,
  reload,
}: {
  settings: Preferences;
  capabilities: Capabilities;
  reload: () => void;
}) {
  const [form, setForm] = useState(settings);
  const action = useAction();
  const auth = useAuth();
  const dirty = JSON.stringify(form) !== JSON.stringify(settings);
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        void action.run(
          (signal) =>
            request<Preferences>('/settings', {
              ...json('PATCH', { ...form, name: form.name.trim(), email: form.email.trim() }),
              signal,
            }),
          (saved) => {
            setForm(saved);
            reload();
            auth.reload();
          },
          'Settings saved.',
        );
      }}
    >
      <Panel>
        <h2 className="mb-5 text-xl font-bold">Account</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="profile-name" label="Name">
            <input
              id="profile-name"
              className={fieldClass}
              required
              maxLength={100}
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field id="profile-email" label="Email">
            <input
              id="profile-email"
              className={fieldClass}
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-5 text-xl font-bold">Capture and model preferences</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="capture-source" label="Default capture source">
            <select
              id="capture-source"
              className={fieldClass}
              required
              value={form.captureSource}
              onChange={(e) => setForm({ ...form, captureSource: e.target.value })}
            >
              <option value="">Choose a source</option>
              {capabilities.captureSources.map((source) => (
                <option key={source}>{source}</option>
              ))}
            </select>
          </Field>
          <Field id="model" label="Answer model">
            <select
              id="model"
              className={fieldClass}
              value={form.modelId || ''}
              onChange={(e) => setForm({ ...form, modelId: e.target.value || null })}
            >
              <option value="">Server default</option>
              {capabilities.models.map((model) => (
                <option key={model.id} value={model.id} disabled={!model.available}>
                  {model.label}
                  {!model.available ? ' (unavailable)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="mt-4 text-sm">
          Model options come from the server. Provider credentials and model adapters are configured
          privately on Render, never in your browser.
        </p>
        {!capabilities.models.length && <Notice>No AI models are configured yet.</Notice>}
      </Panel>
      <ErrorNotice error={action.error} />
      <Notice>{action.message}</Notice>
      <Button type="submit" disabled={action.pending || !dirty}>
        {action.pending ? 'Saving…' : 'Save changes'}
      </Button>
      {dirty && <Notice>You have unsaved changes.</Notice>}
    </form>
  );
}
function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const action = useAction();
  return (
    <Panel>
      <h2 className="mb-4 text-xl font-bold">Change password</h2>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            (signal) =>
              request<void>('/auth/password', {
                ...json('PUT', { currentPassword: current, newPassword: next }),
                signal,
              }),
            () => {
              setCurrent('');
              setNext('');
            },
            'Password updated. Other sessions have been revoked.',
          );
        }}
      >
        <Field id="current-password" label="Current password">
          <input
            id="current-password"
            className={fieldClass}
            type="password"
            required
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field id="new-password" label="New password">
          <input
            id="new-password"
            className={fieldClass}
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <ErrorNotice error={action.error} />
        <Notice>{action.message}</Notice>
        <Button type="submit" disabled={action.pending}>
          Update password
        </Button>
      </form>
    </Panel>
  );
}
export function Settings() {
  const settings = useResource<Preferences>('/settings');
  const caps = useResource<Capabilities>('/capabilities');
  return (
    <Page
      title="Settings"
      description="Control your account and the options used for capture and answers."
    >
      <ErrorNotice error={settings.error} retry={settings.reload} />
      <ErrorNotice error={caps.error} retry={caps.reload} />
      {(settings.loading || caps.loading) && <Loading />}
      {settings.data && caps.data && (
        <SettingsForm settings={settings.data} capabilities={caps.data} reload={settings.reload} />
      )}
      <PasswordForm />
    </Page>
  );
}
