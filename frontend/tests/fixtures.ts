import type { Page } from '@playwright/test';
import type {
  Analytics,
  Capabilities,
  DocumentRecord,
  Job,
  Meeting,
  Session,
  Settings,
  Share,
  Task,
  Conversation,
  Answer,
  Invitation,
} from '../src/api/types';
export const capabilities: Capabilities = {
  acceptedMimeTypes: [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'audio/webm',
  ],
  maxFileBytes: 5_000_000,
  maxBatchFiles: 10,
  maxTextCharacters: 20000,
  maxRecordingSeconds: 60,
  captureSources: ['file', 'camera', 'text', 'audio'],
  documentTypes: ['Lecture note', 'Assignment', 'Project report', 'Bill'],
  topics: ['Machine Learning'],
  models: [{ id: 'test-model', label: 'Test-configured model', available: true }],
  transcription: true,
  multimodal: true,
};
export const document: DocumentRecord = {
  id: 'doc-1',
  title: 'Lecture notes',
  createdAt: '2026-10-15T09:00:00Z',
  sourceType: 'scanned',
  documentType: 'Lecture note',
  tags: ['Machine Learning'],
  text: 'Read the model evaluation notes. Finish the assignment on Friday.',
  original: null,
  processed: null,
  thumbnailUrl: null,
  summary: 'Model evaluation and assignment planning.',
  meetingId: 'meeting-1',
  permission: 'owner',
};
export const task: Task = {
  id: 'task-1',
  description: 'Finish the assignment',
  status: 'pending',
  priority: 'high',
  dueDate: '2026-10-16',
  source: { documentId: document.id, title: document.title },
  meetingId: 'meeting-1',
};
const collection = <T>(items: T[], url: URL) => ({
  items,
  total: items.length,
  page: Number(url.searchParams.get('page')) || 1,
  pageSize: 20,
});
export async function installApi(page: Page, role: 'user' | 'admin' | 'anonymous' = 'user') {
  const user = {
    id: 'user-1',
    name: 'Test Reader',
    email: 'reader@example.org',
    role: role === 'admin' ? ('admin' as const) : ('user' as const),
    onboardingComplete: true,
  };
  const invitations: Invitation[] = [
    {
      id: 'invite-1',
      documentId: 'doc-1',
      documentTitle: 'Shared notes',
      ownerName: 'Classmate',
      permission: 'view',
      status: 'pending',
    },
  ];
  const state = {
    invitations,
    session: { user: role === 'anonymous' ? null : user, csrfToken: 'test-csrf' } as Session,
    doc: structuredClone(document),
    tasks: [structuredClone(task)],
    shares: [] as Share[],
    settings: {
      name: user.name,
      email: user.email,
      captureSource: 'file',
      modelId: null,
    } as Settings,
    conversation: null as Conversation | null,
    requests: [] as {
      path: string;
      search: string;
      method: string;
      body: string | null;
      csrf: string | undefined;
    }[],
  };
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace('/api/v1', '');
    const method = req.method();
    const body = req.headers()['content-type']?.includes('application/json')
      ? req.postDataJSON()
      : {};
    state.requests.push({
      path,
      search: url.search,
      method,
      body: req.postData(),
      csrf: req.headers()['x-csrf-token'],
    });
    const send = (value: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    const error = (status: number, message: string) =>
      send({ error: { code: status === 403 ? 'FORBIDDEN' : 'ERROR', message } }, status);
    if (method !== 'GET' && req.headers()['x-csrf-token'] !== 'test-csrf')
      return error(403, 'CSRF rejected');
    if (path === '/session') return send(state.session);
    if (path === '/capabilities') return send(capabilities);
    if (path === '/auth/login' || path === '/auth/register') {
      if (!body.email || !body.password) return error(422, 'Credentials required');
      state.session.user = user;
      return send(state.session);
    }
    if (path === '/auth/logout') {
      state.session.user = null;
      return send(state.session);
    }
    if (!state.session.user) return error(401, 'Sign in again');
    if (path.startsWith('/admin') && state.session.user.role !== 'admin')
      return error(403, 'Admin access required');
    if (path === '/onboarding') {
      state.session.user.onboardingComplete = true;
      return send(state.session);
    }
    if (path === '/auth/password') return route.fulfill({ status: 204 });
    if (path === '/settings') {
      if (method === 'PATCH') Object.assign(state.settings, body);
      return send(state.settings);
    }
    if (path === '/documents') {
      let docs = [state.doc];
      const q = url.searchParams.get('q');
      if (q && !state.doc.title.toLowerCase().includes(q.toLowerCase())) docs = [];
      return send(collection(docs, url));
    }
    if (path === '/documents/doc-1') {
      if (method === 'PATCH') Object.assign(state.doc, body);
      return send(state.doc);
    }
    if (path === '/documents/doc-1/shares') {
      if (method === 'POST') {
        const share: Share = { id: `share-${state.shares.length + 1}`, ...body, status: 'pending' };
        state.shares.push(share);
        return send(share, 201);
      }
      return send({ items: state.shares });
    }
    if (path.startsWith('/documents/doc-1/shares/')) {
      const shareId = path.split('/').at(-1);
      const share = state.shares.find((s) => s.id === shareId);
      if (method === 'DELETE') {
        state.shares = state.shares.filter((s) => s.id !== shareId);
        return route.fulfill({ status: 204 });
      }
      Object.assign(share!, body);
      return send(share);
    }
    if (path.startsWith('/documents/'))
      return error(404, 'Document not found or no longer shared with you.');
    if (path === '/invitations') return send({ items: state.invitations });
    if (path.startsWith('/invitations/invite-1/')) {
      state.invitations[0].status = path.endsWith('/accept') ? 'accepted' : 'declined';
      return send(state.invitations[0]);
    }
    if (path === '/tasks') {
      if (method === 'POST') {
        const created: Task = {
          ...task,
          ...body,
          id: `task-${state.tasks.length + 1}`,
          status: 'pending',
          source: task.source,
        };
        state.tasks.push(created);
        return send(created, 201);
      }
      let tasks = state.tasks;
      const status = url.searchParams.get('status');
      if (status) tasks = tasks.filter((t) => t.status === status);
      const q = url.searchParams.get('q');
      if (q) tasks = tasks.filter((t) => t.description.toLowerCase().includes(q.toLowerCase()));
      return send(collection(tasks, url));
    }
    if (path.startsWith('/tasks/')) {
      const id = path.split('/').at(-1);
      if (method === 'DELETE') {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        return route.fulfill({ status: 204 });
      }
      const current = state.tasks.find((t) => t.id === id);
      Object.assign(current!, body);
      return send(current);
    }
    const job: Job = {
      id: 'job-1',
      status: 'succeeded',
      stage: 'Processing complete',
      progress: 100,
      items: [{ name: 'notes.txt', status: 'succeeded', documentId: 'doc-1', error: null }],
      error: null,
      retryable: false,
      meetingId: 'meeting-1',
    };
    if (path === '/ingestions' || path.startsWith('/jobs/'))
      return send(job, path === '/ingestions' ? 202 : 200);
    const meeting: Meeting = {
      id: 'meeting-1',
      title: 'Project review',
      occurredAt: '2026-10-15T10:00:00Z',
      summary: 'Review model evaluation.',
      decisions: ['Use the reviewed dataset.'],
      documents: [state.doc],
      tasks: state.tasks,
    };
    if (path === '/meetings/meeting-1/summarize') return send(job, 202);
    if (path === '/meetings')
      return send(method === 'POST' ? { ...meeting, ...body } : collection([meeting], url));
    if (path === '/meetings/meeting-1') return send(meeting);
    if (path === '/timeline')
      return send(
        collection(
          [
            {
              id: 'event-1',
              occurredAt: document.createdAt,
              title: 'Captured lecture notes',
              type: 'document.created',
              source: task.source,
              meetingId: null,
            },
          ],
          url,
        ),
      );
    if (path === '/conversations')
      return send(collection(state.conversation ? [state.conversation] : [], url));
    if (path === '/conversations/conversation-1') return send(state.conversation);
    if (path === '/assistant/query') {
      const userMessage = {
        id: 'message-1',
        role: 'user' as const,
        text: 'What should I do?',
        createdAt: document.createdAt,
        sources: [],
        insufficientEvidence: false,
      };
      const answer = {
        id: 'message-2',
        role: 'assistant' as const,
        text: 'Finish the assignment on Friday.',
        createdAt: document.createdAt,
        sources: [{ ...task.source, page: 1, excerpt: document.text }],
        insufficientEvidence: false,
      };
      state.conversation = {
        id: 'conversation-1',
        title: 'Assignment question',
        updatedAt: document.createdAt,
        messages: [userMessage, answer],
      };
      const result: Answer = { conversationId: 'conversation-1', userMessage, answer };
      return send(result);
    }
    if (path === '/analytics') {
      const result: Analytics = {
        documentCount: 84,
        pendingTaskCount: state.tasks.filter((t) => t.status === 'pending').length,
        completedTaskCount: state.tasks.filter((t) => t.status === 'completed').length,
        studyMinutes: null,
        studyTimeDefinition: 'Study time is not measured in this test fixture.',
        topicCoverage: [{ topic: 'Machine Learning', count: 1 }],
        activity: [{ date: '2026-10-15', documents: 1, completedTasks: 0 }],
        period: { from: '2026-10-09', to: '2026-10-15' },
      };
      return send(result);
    }
    if (path === '/admin/status')
      return send({
        storageUsedBytes: 1200,
        documentCount: 1,
        queuedJobs: 0,
        failedJobs: 0,
        services: [
          { name: 'Test-configured generation', status: 'ready', message: 'Test fixture only.' },
        ],
      });
    if (path === '/admin/config')
      return send(
        method === 'PATCH'
          ? body
          : {
              storageLimitBytes: 10_000_000,
              defaultModelId: 'test-model',
              captureSources: capabilities.captureSources,
            },
      );
    return error(404, `Unmocked test route: ${method} ${path}`);
  });
  return state;
}
