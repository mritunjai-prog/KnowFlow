import { useState } from 'react';
import { key, json, request } from '../../api/client';
import { useAction, useResource } from '../../api/hooks';
import type { Share } from '../../api/types';
import { Panel, Loading, ErrorNotice, Field, fieldClass, Notice, Dialog } from './Feedback';
import { Button } from './Button';
export function DocumentShares({ documentId }: { documentId: string }) {
  const path = `/documents/${key(documentId)}/shares`;
  const result = useResource<{ items: Share[] }>(path);
  const action = useAction();
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit'>('view');
  const [remove, setRemove] = useState<Share | null>(null);
  return (
    <Panel>
      <h2 className="text-xl font-bold">Share this document</h2>
      <p className="mb-4 mt-2 text-sm">
        View allows reading and source-backed retrieval. Edit also allows correcting title, text and
        tags. Only you can grant or revoke access. There are no shared workspaces.
      </p>
      <ErrorNotice error={result.error} retry={result.reload} />
      {result.loading && <Loading />}
      {result.data && (
        <ul className="mb-6 space-y-3">
          {result.data.items.map((share) => (
            <li
              key={share.id}
              className="flex flex-wrap items-center gap-3 border-b border-primary/20 pb-3"
            >
              <span className="min-w-0 flex-1 break-all">
                {share.email} · {share.status}
              </span>
              <label className="sr-only" htmlFor={`permission-${share.id}`}>
                Permission for {share.email}
              </label>
              <select
                id={`permission-${share.id}`}
                className={`${fieldClass} !w-auto`}
                value={share.permission}
                disabled={action.pending}
                onChange={(e) =>
                  void action.run(
                    (signal) =>
                      request<Share>(`${path}/${key(share.id)}`, {
                        ...json('PATCH', { permission: e.target.value }),
                        signal,
                      }),
                    result.reload,
                    'Permission updated.',
                  )
                }
              >
                <option value="view">View</option>
                <option value="edit">Edit</option>
              </select>
              <Button
                variant="secondary"
                disabled={action.pending}
                onClick={() => setRemove(share)}
              >
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col items-start gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            (signal) =>
              request<Share>(path, {
                ...json('POST', { email: email.trim(), permission }),
                signal,
              }),
            () => {
              setEmail('');
              result.reload();
            },
            'Sharing invitation saved.',
          );
        }}
      >
        <div className="w-full min-w-0 flex-1">
          <Field id="share-email" label="Recipient email">
            <input
              id="share-email"
              className={fieldClass}
              type="email"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Field id="share-permission" label="Permission">
          <select
            id="share-permission"
            className={fieldClass}
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'view' | 'edit')}
          >
            <option value="view">View</option>
            <option value="edit">Edit</option>
          </select>
        </Field>
        <Button type="submit" disabled={action.pending || !result.data}>
          Share document
        </Button>
      </form>
      <ErrorNotice error={action.error} />
      <Notice>{action.message}</Notice>
      {remove && (
        <Dialog title="Revoke access?" onClose={() => setRemove(null)}>
          <p className="mb-4">
            {remove.email} will lose access to this document through KnowFlow. Previously downloaded
            copies cannot be recalled.
          </p>
          <ErrorNotice error={action.error} />
          <Button
            disabled={action.pending}
            onClick={() =>
              void action.run(
                (signal) =>
                  request<void>(`${path}/${key(remove.id)}`, { method: 'DELETE', signal }),
                () => {
                  setRemove(null);
                  result.reload();
                },
                'Access revoked.',
              )
            }
          >
            Revoke access
          </Button>
        </Dialog>
      )}
    </Panel>
  );
}
