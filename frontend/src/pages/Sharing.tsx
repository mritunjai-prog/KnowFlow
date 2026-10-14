import { Link } from 'react-router-dom';
import { useAction, useResource } from '../api/hooks';
import { json, key, request } from '../api/client';
import type { Invitation } from '../api/types';
import { Page, Panel, Loading, Empty, ErrorNotice, Notice } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
export function Sharing() {
  const result = useResource<{ items: Invitation[] }>('/invitations');
  const action = useAction();
  return (
    <Page
      title="Document sharing"
      description="Accept or decline invitations to specific documents. Accepting does not grant access to a workspace or other documents."
      actions={
        <Link to="/library?ownership=shared" className="underline">
          Shared with me
        </Link>
      }
    >
      <ErrorNotice error={result.error} retry={result.reload} />
      <ErrorNotice error={action.error} />
      <Notice>{action.message}</Notice>
      {result.loading && <Loading />}
      {result.data &&
        (!result.data.items.length ? (
          <Empty>
            No document invitations. Owners can share a document with the email linked to your
            account.
          </Empty>
        ) : (
          <ul className="space-y-4">
            {result.data.items.map((invite) => (
              <li key={invite.id}>
                <Panel>
                  <h2 className="text-xl font-bold">{invite.documentTitle}</h2>
                  <p className="my-3">
                    From {invite.ownerName} · {invite.permission} permission · {invite.status}
                  </p>
                  {invite.status === 'pending' ? (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={action.pending}
                        onClick={() =>
                          void action.run(
                            (signal) =>
                              request<Invitation>(`/invitations/${key(invite.id)}/accept`, {
                                ...json('POST'),
                                signal,
                              }),
                            result.reload,
                            'Invitation accepted.',
                          )
                        }
                      >
                        Accept invitation
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={action.pending}
                        onClick={() =>
                          void action.run(
                            (signal) =>
                              request<Invitation>(`/invitations/${key(invite.id)}/decline`, {
                                ...json('POST'),
                                signal,
                              }),
                            result.reload,
                            'Invitation declined.',
                          )
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  ) : invite.status === 'accepted' ? (
                    <Link className="underline" to={`/document/${key(invite.documentId)}`}>
                      Open shared document
                    </Link>
                  ) : null}
                </Panel>
              </li>
            ))}
          </ul>
        ))}
    </Page>
  );
}
