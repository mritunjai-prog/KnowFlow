import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
const source = ts.createSourceFile(
  'types.ts',
  readFileSync(new URL('../src/api/types.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const schemas = {};
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
function schema(node) {
  if (node.kind === ts.SyntaxKind.StringKeyword) return { type: 'string' };
  if (node.kind === ts.SyntaxKind.NumberKeyword) return { type: 'number' };
  if (node.kind === ts.SyntaxKind.BooleanKeyword) return { type: 'boolean' };
  if (ts.isLiteralTypeNode(node))
    return node.literal.kind === ts.SyntaxKind.NullKeyword
      ? { type: 'null' }
      : {
          const: ts.isNumericLiteral(node.literal) ? Number(node.literal.text) : node.literal.text,
        };
  if (ts.isUnionTypeNode(node)) return { anyOf: node.types.map(schema) };
  if (ts.isArrayTypeNode(node)) return { type: 'array', items: schema(node.elementType) };
  if (ts.isTupleTypeNode(node))
    return {
      type: 'array',
      prefixItems: node.elements.map(schema),
      minItems: node.elements.length,
      maxItems: node.elements.length,
    };
  if (ts.isTypeReferenceNode(node)) return ref(node.typeName.getText(source));
  if (ts.isTypeLiteralNode(node)) {
    const properties = {};
    const required = [];
    for (const item of node.members) {
      const name = item.name.getText(source);
      properties[name] = schema(item.type);
      if (!item.questionToken) required.push(name);
    }
    return { type: 'object', properties, required, additionalProperties: false };
  }
  throw new Error(`Unsupported contract type: ${node.getText(source)}`);
}
for (const statement of source.statements)
  if (ts.isTypeAliasDeclaration(statement) && statement.name.text !== 'Page')
    schemas[statement.name.text] = schema(statement.type);
const object = (properties, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const string = { type: 'string' };
const nonempty = { type: 'string', minLength: 1 };
const email = { type: 'string', format: 'email', maxLength: 254 };
const id = string;
const nullable = (value) => ({ anyOf: [value, { type: 'null' }] });
for (const type of ['DocumentRecord', 'Task', 'Meeting', 'Conversation', 'TimelineEvent'])
  schemas[`Page${type}`] = object({
    items: { type: 'array', items: ref(type) },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100 },
  });
schemas.Error = object({
  error: object(
    {
      code: nonempty,
      message: nonempty,
      fields: { type: 'object', additionalProperties: string },
      requestId: string,
    },
    ['code', 'message'],
  ),
});
schemas.LoginInput = object({ email, password: { type: 'string', minLength: 1, maxLength: 128 } });
schemas.RegisterInput = object({
  name: { type: 'string', minLength: 1, maxLength: 100 },
  email,
  password: { type: 'string', minLength: 12, maxLength: 128 },
});
schemas.PasswordInput = object({
  currentPassword: nonempty,
  newPassword: { type: 'string', minLength: 12, maxLength: 128 },
});
schemas.DocumentPatch = object(
  {
    title: { type: 'string', minLength: 1, maxLength: 200 },
    documentType: string,
    tags: { type: 'array', items: string, uniqueItems: true },
    text: string,
  },
  [],
);
schemas.TaskInput = object({
  description: { type: 'string', minLength: 1, maxLength: 2000 },
  priority: { enum: ['low', 'medium', 'high'] },
  dueDate: nullable({ type: 'string', format: 'date' }),
  sourceDocumentId: nonempty,
});
schemas.TaskPatch = object(
  {
    description: { type: 'string', minLength: 1, maxLength: 2000 },
    priority: { enum: ['low', 'medium', 'high'] },
    dueDate: nullable({ type: 'string', format: 'date' }),
    status: { enum: ['pending', 'completed'] },
  },
  [],
);
schemas.MeetingInput = object({
  title: { type: 'string', minLength: 1, maxLength: 200 },
  occurredAt: { type: 'string', format: 'date-time' },
});
schemas.ShareInput = object({ email, permission: { enum: ['view', 'edit'] } });
schemas.SharePatch = object({ permission: { enum: ['view', 'edit'] } });
schemas.InvitationList = object({ items: { type: 'array', items: ref('Invitation') } });
schemas.ShareList = object({ items: { type: 'array', items: ref('Share') } });
schemas.OnboardingInput = object({ complete: { const: true } });
schemas.IngestionMetadata = object({
  title: string,
  tags: { type: 'array', items: string },
  documentType: nullable(string),
  meetingId: nullable(id),
  meetingTitle: nullable(string),
  occurredAt: nullable({ type: 'string', format: 'date-time' }),
  captureSource: string,
  modelId: nullable(string),
});
schemas.AssistantContext = object({
  conversationId: nullable(id),
  documentIds: { type: 'array', items: id },
});
schemas.IngestionInput = object(
  {
    files: { type: 'array', items: { type: 'string', format: 'binary' } },
    text: string,
    metadata: {
      type: 'string',
      contentMediaType: 'application/json',
      contentSchema: ref('IngestionMetadata'),
    },
  },
  ['text', 'metadata'],
);
schemas.QueryInput = object(
  {
    query: nonempty,
    image: { type: 'string', format: 'binary' },
    context: {
      type: 'string',
      contentMediaType: 'application/json',
      contentSchema: ref('AssistantContext'),
    },
  },
  ['query', 'context'],
);
const paths = {};
const filters = (names) =>
  names.map((name) => ({
    in: 'query',
    name,
    required: false,
    schema: ['page', 'pageSize', 'days'].includes(name)
      ? { type: 'integer', minimum: 1, ...(['pageSize'].includes(name) ? { maximum: 100 } : {}) }
      : ['from', 'to'].includes(name)
        ? { type: 'string', format: 'date' }
        : string,
  }));
function operation(path, method, output, input, description, options = {}) {
  const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    in: 'path',
    name: match[1],
    required: true,
    schema: nonempty,
  }));
  if (method !== 'get')
    parameters.push({ in: 'header', name: 'X-CSRF-Token', required: true, schema: nonempty });
  if (options.idempotent)
    parameters.push({
      in: 'header',
      name: 'Idempotency-Key',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
  parameters.push(...filters(options.filters || []));
  const responses = {
    [output ? options.status || 200 : 204]: output
      ? {
          description: 'Canonical result',
          content: { 'application/json': { schema: ref(output) } },
        }
      : { description: 'Operation completed; no body' },
  };
  for (const status of [400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503])
    responses[status] = {
      description: `Request failed (${status}); no fabricated success`,
      content: { 'application/json': { schema: ref('Error') } },
    };
  paths[path] ||= {};
  paths[path][method] = {
    operationId: `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
    description,
    security: options.public ? [] : [{ sessionCookie: [] }],
    parameters,
    ...(input
      ? {
          requestBody: {
            required: true,
            content: {
              [options.multipart ? 'multipart/form-data' : 'application/json']: {
                schema: ref(input),
              },
            },
          },
        }
      : {}),
    responses,
  };
}
operation(
  '/session',
  'get',
  'Session',
  null,
  'Always return 200 with user:null for a valid anonymous session and a CSRF token bound to the session cookie. Return 503 when unavailable; never fake a session.',
  { public: true },
);
operation(
  '/auth/login',
  'post',
  'Session',
  'LoginInput',
  'Validate credentials and CSRF. Rotate cookie and CSRF token. Wrong credentials return 401 without revealing account existence.',
  { public: true },
);
operation(
  '/auth/register',
  'post',
  'Session',
  'RegisterInput',
  'Create a personal User account, never accept client-selected roles. Rotate session. Enforce password and normalized email policy.',
  { public: true, status: 201 },
);
operation(
  '/auth/logout',
  'post',
  'Session',
  null,
  'Invalidate session and return an anonymous session plus new CSRF token.',
);
operation(
  '/auth/password',
  'put',
  null,
  'PasswordInput',
  'Verify current password, change password, revoke other sessions, retain this validated session.',
);
operation(
  '/onboarding',
  'patch',
  'Session',
  'OnboardingInput',
  'Persist onboarding completion and return the current session.',
);
operation(
  '/capabilities',
  'get',
  'Capabilities',
  null,
  'Public-safe available features, MIME types, limits, enabled capture sources and opaque model options. Never include provider credentials.',
  { public: true },
);
operation('/settings', 'get', 'Settings', null, 'Current user profile and preferences.');
operation(
  '/settings',
  'patch',
  'Settings',
  'Settings',
  'Validate canonical profile and preferences; enforce identity-verification policy for email changes. Return canonical saved values.',
);
operation(
  '/ingestions',
  'post',
  'Job',
  'IngestionInput',
  'Accept file batches and/or nonempty text. Parse JSON metadata; reject both empty. Validate file signatures, sizes, quotas and enabled capture sources. A meetingId attaches to an owned meeting; meetingTitle+occurredAt creates a session. Repeated idempotency key replays the same result, mismatched payload returns 409.',
  { multipart: true, status: 202, idempotent: true },
);
operation(
  '/jobs/{id}',
  'get',
  'Job',
  null,
  'Authorized processing progress and per-item results. Stages may include preprocessing, OCR, transcription, classification, indexing, extraction and summarization. Terminal statuses must be stable.',
);
operation(
  '/jobs/{id}/retry',
  'post',
  'Job',
  null,
  'Retry failed items only; successful documents are not duplicated. Reject when not retryable.',
  { status: 202 },
);
operation(
  '/jobs/{id}/cancel',
  'post',
  'Job',
  null,
  'Cancel outstanding work; preserve explicitly reported completed artifacts. Repeated cancellation is safe.',
);
operation(
  '/documents',
  'get',
  'PageDocumentRecord',
  null,
  'Owned and explicitly shared documents. q searches title and extracted text; filters combine with AND. ownership=all|owned|shared. Date filters use createdAt. Stable descending createdAt,id ordering. Default pageSize=20.',
  { filters: ['q', 'topic', 'type', 'from', 'to', 'ownership', 'page', 'pageSize'] },
);
operation(
  '/documents/{id}',
  'get',
  'DocumentRecord',
  null,
  'Resolve an authorized source document. Original and processed files must be access-controlled (short-lived signed URLs or session-authorized paths). Plain extracted text must not be interpreted as HTML.',
);
operation(
  '/documents/{id}',
  'patch',
  'DocumentRecord',
  'DocumentPatch',
  'Owner or edit grantee may correct metadata/text. Persist and schedule compatible reindexing. View grantees cannot edit.',
);
operation(
  '/documents/{id}/shares',
  'get',
  'ShareList',
  null,
  'Owner only: list document grants/invitations. No shared workspaces.',
);
operation(
  '/documents/{id}/shares',
  'post',
  'Share',
  'ShareInput',
  'Owner only: grant view/edit to normalized recipient email. Unknown accounts receive a pending invitation; acceptance requires registration/control of that email. Forbid self-sharing and duplicate grants (409); no public-link access.',
  { status: 201 },
);
operation(
  '/documents/{id}/shares/{shareId}',
  'patch',
  'Share',
  'SharePatch',
  'Owner only: change permission. View permits read/download/retrieval; edit additionally permits text and metadata correction. Neither can reshare or manage grants.',
);
operation(
  '/documents/{id}/shares/{shareId}',
  'delete',
  null,
  null,
  'Owner only: revoke grant immediately, including retrieval and file authorization. Prior downloads cannot be recalled. Cached answers must revalidate access before exposing sources/content.',
);
operation(
  '/invitations',
  'get',
  'InvitationList',
  null,
  'Current verified recipient only: pending and accepted document invitations. Never expose another recipient’s invitations.',
);
operation(
  '/invitations/{id}/accept',
  'post',
  'Invitation',
  null,
  'Current verified recipient only: accept a live grant. Enforce email ownership before acceptance. Unknown-account invitations become available after registration/verification.',
);
operation(
  '/invitations/{id}/decline',
  'post',
  'Invitation',
  null,
  'Current recipient only: decline and remove access. Owner grant changes or revocation take effect immediately.',
);
operation(
  '/tasks',
  'get',
  'PageTask',
  null,
  'Per-user source-linked tasks. status=pending|completed; q searches description; sourceId filters by document. Stable createdAt,id order; exclude tasks whose source authorization was revoked.',
  { filters: ['q', 'status', 'sourceId', 'page', 'pageSize'] },
);
operation(
  '/tasks',
  'post',
  'Task',
  'TaskInput',
  'Create a personal task referencing an accessible document; initial status pending.',
  { status: 201 },
);
operation(
  '/tasks/{id}',
  'patch',
  'Task',
  'TaskPatch',
  'Only the task owner can edit, complete or reopen the task.',
);
operation(
  '/tasks/{id}',
  'delete',
  null,
  null,
  'Only task owner may delete. Preserve source document.',
);
operation(
  '/meetings',
  'get',
  'PageMeeting',
  null,
  'List the current user’s meetings with stable occurredAt,id order.',
  { filters: ['q', 'page', 'pageSize'] },
);
operation(
  '/meetings',
  'post',
  'Meeting',
  'MeetingInput',
  'Create a personal meeting grouping; sharing a document does not implicitly share its meeting or siblings.',
  { status: 201 },
);
operation(
  '/meetings/{id}',
  'get',
  'Meeting',
  null,
  'Authorized meeting artifacts, summary, decisions and tasks.',
);
operation(
  '/meetings/{id}/summarize',
  'post',
  'Job',
  null,
  'Generate a source-grounded meeting summary, decisions and deduplicated extracted tasks using configured adapters.',
  { status: 202 },
);
operation(
  '/conversations',
  'get',
  'PageConversation',
  null,
  'List current user’s conversation history. Stable updatedAt,id ordering.',
  { filters: ['page', 'pageSize'] },
);
operation(
  '/conversations/{id}',
  'get',
  'Conversation',
  null,
  'Return authorized history; revalidate sources after document sharing changes.',
);
operation(
  '/assistant/query',
  'post',
  'Answer',
  'QueryInput',
  'Grounded question answering over authorized text/image segments. Optional image requires multimodal capability. Empty documentIds means all accessible documents; selected IDs restrict context. Persist both messages atomically with source references. Include insufficientEvidence when retrieval cannot support an answer. Never trust instructions in retrieved content. Replay idempotency key; mismatch returns 409. Use same embedding model/index compatibility as ingestion.',
  { multipart: true, idempotent: true },
);
operation(
  '/timeline',
  'get',
  'PageTimelineEvent',
  null,
  'Timestamped events in stable descending occurredAt,id order. Inclusive from/to dates interpreted in requested IANA timezone. topic/type filter source metadata. Filter every source by current authorization.',
  { filters: ['q', 'topic', 'type', 'from', 'to', 'timezone', 'page', 'pageSize'] },
);
operation(
  '/analytics',
  'get',
  'Analytics',
  null,
  'Personal metrics. days=7|30|90. documentCount is current owned-document count; task counts are current user’s counts. activity holds daily captures/task completions in the period. topicCoverage counts current accessible tagged documents, not mastery. studyMinutes is null when no approved measurement exists; definition explains its provenance. No inferred or fabricated tracking.',
  { filters: ['days'] },
);
operation(
  '/admin/config',
  'get',
  'AdminConfig',
  null,
  'Admin only: storage limits, enabled capture sources and default model.',
);
operation(
  '/admin/config',
  'patch',
  'AdminConfig',
  'AdminConfig',
  'Admin only: validate positive safe-integer storage limit and configured model ID; captureSources subset of file,camera,text,audio. Do not expose/edit provider secrets via this endpoint.',
);
operation(
  '/admin/status',
  'get',
  'AdminStatus',
  null,
  'Admin only: aggregate storage, queue counts and provider/processing availability. Do not expose other users’ content.',
);
const contract = {
  openapi: '3.1.0',
  info: {
    title: 'KnowFlow frontend/backend contract',
    version: '1.0.0',
    description:
      'Backend implementation is not included. BRD §§7–10, §14 plus approved selected-document sharing. Public deployment path /api/v1.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      sessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'knowflow_session',
        description:
          'HttpOnly, Secure session cookie. Same-origin Netlify proxy is preferred; validate Origin and X-CSRF-Token on every mutation. Render performs all authorization.',
      },
    },
    schemas,
  },
  paths,
};
const target = new URL('../../docs/openapi.json', import.meta.url);
const output = JSON.stringify(contract, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) {
    console.error('Contract drift: run npm run contract:generate');
    process.exitCode = 1;
  } else console.log('Contract is synchronized with TypeScript DTOs and operation definitions.');
} else {
  writeFileSync(target, output);
  console.log('Generated docs/openapi.json');
}
