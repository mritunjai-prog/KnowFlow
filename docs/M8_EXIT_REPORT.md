# M8 exit report

Date: 2026-11-11. Scope: selected-document sharing and revocation. This is a local verification record, not a deployment or email-delivery claim.

Authority: BRD §14 as clarified to selected-document permission sharing, the M8 roadmap exit gate, `docs/BACKEND_HANDOFF.md` sharing rules, and the published share and invitation shapes. `docs/openapi.json` and `frontend/` were not edited.

## What landed

- The owner can invite by email, list grants, change view or edit, and revoke. The address is stored in lowercase. Sharing with oneself, or inviting an address that already has a live grant, is rejected. A viewer, an editor, an outsider, and Admin cannot manage grants. Admin is not treated as an owner.
- An invitation to an unknown address stays pending. It becomes visible only after that address is registered and verified, and only to that account. Acceptance is a separate step. It does not happen at registration.
- A pending invitation returns the document title, owner name, and permission. It does not return the text, a file URL, the meeting, a sibling document, or the owner's tasks. Declined and expired invitations are omitted from the recipient list and do not grant access. The decline call itself returns `declined`, which the published invitation shape allows.
- Pending invitations expire after 7 days. That duration is not in the contract or the M0 record. It is recorded here so expiry can be enforced and tested. An accepted grant does not expire on that clock. The owner can invite the same address again after a decline, revocation, or expiry.
- View can read the document, receive a short-lived file URL, and use it in retrieval. Edit can also correct title, type, tags, and text. Neither can invite, change a grant, or revoke. There is no published document-delete operation, so an editor cannot delete the document.
- Sharing one document does not share its meeting, sibling documents, or the owner's tasks. The shared document response and timeline omit the meeting id.
- Revocation and downgrade apply to the next request. A revoked recipient no longer receives the document, a new file or thumbnail URL, a timeline item, a task, or a retrieval corpus that includes it. A saved answer that cited the revoked document is replaced with a notice that it is no longer available. The citation is removed as well. The old answer text is not left in place with only the link removed.
- A file URL that was already issued still opens until it expires. That expiry is 60 seconds. This is the M0 rule: revocation stops new URLs, and an already-issued URL cannot be recalled. A copy already downloaded cannot be recalled either.

## Checks

`PYTHONPATH=/home/user/KnowFlow/backend /tmp/knowflow-m1/bin/pytest -q backend/tests` → **56 passed, 1 warning in 47.71s**.

The warning is Starlette's `httpx`/`httpx2` TestClient notice. The run includes M1–M8. No Gemini, Groq, R2, or Neon call.

Covered locally, with Ada as owner, Bea as recipient, Cy as outsider, and a verified Admin:

- self-share and duplicate live grants are rejected; email case is normalized
- Bea cannot read the document until she accepts; Cy and Admin cannot read it or its grants
- after acceptance, Bea can correct the text, then cannot correct it after a downgrade to view
- Bea cannot reshare, list grants, open the meeting, open the sibling note, or see Ada's task
- the shared timeline item has no meeting id and does not include the sibling text
- revocation removes the document, shared library row, and timeline item; a previously issued file URL still returns the bytes
- a saved answer that contained the source sentence is replaced, and a new question restricted to that document is not found
- an invitation to an address that is verified later stays private until acceptance; decline and expiry leave the document private; the owner can invite again

## Conflicts

- BRD §14 says sharing workspaces. The owner already chose selected-document grants. No workspace object was added.
- M0 says an already-issued file URL cannot be recalled. The M8 exit wording also says new file requests must stop. New document requests do not mint a URL after revocation. A request that still holds the old URL works until the 60-second expiry. That is the approved limit, not a claim that every in-flight URL dies instantly.
- The published invitation list is described as pending and accepted. Declined is a legal response status, but it is not kept in the list. Expired and revoked are not published statuses, so those grants are omitted rather than given a new label.
- The 7-day pending lifetime is not specified in the contract. It is an implementation choice recorded above.

## Not done

- No email is sent. The invitation appears in the recipient's list after they verify the invited address. Production email remains blocked until a no-cost sending path exists.
- No physical second browser. The users are separate verified accounts in the local test client.
- This work is uncommitted. `main` was not changed.
