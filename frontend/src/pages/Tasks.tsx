import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource, useAction } from '../api/hooks';
import { json, key, query, request } from '../api/client';
import type { DocumentRecord, Task, Page as PageData } from '../api/types';
import {
  Page,
  Panel,
  Loading,
  Empty,
  ErrorNotice,
  Field,
  fieldClass,
  Pager,
  Dialog,
  Notice,
} from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { useFilters } from '../hooks/useFilters';
function TaskForm({
  task,
  sourceId,
  onDone,
}: {
  task?: Task;
  sourceId?: string;
  onDone: () => void;
}) {
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [documentId, setDocumentId] = useState(task?.source.documentId || sourceId || '');
  const [search, setSearch] = useState('');
  const [sourcePage, setSourcePage] = useState(1);
  const docs = useResource<PageData<DocumentRecord>>(
    !task ? `/documents${query({ q: search, page: sourcePage, pageSize: 20 })}` : null,
  );
  const action = useAction();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!description.trim()) return;
        void action.run(
          (signal) =>
            request<Task>(task ? `/tasks/${key(task.id)}` : '/tasks', {
              ...json(task ? 'PATCH' : 'POST', {
                description: description.trim(),
                priority,
                dueDate: dueDate || null,
                ...(!task ? { sourceDocumentId: documentId } : {}),
              }),
              signal,
            }),
          onDone,
        );
      }}
    >
      <Field id="task-description" label="Task description">
        <textarea
          id="task-description"
          className={fieldClass}
          rows={3}
          required
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <Field id="task-priority" label="Priority">
        <select
          id="task-priority"
          className={fieldClass}
          value={priority}
          onChange={(e) => setPriority(e.target.value as Task['priority'])}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </Field>
      <Field id="task-due" label="Due date">
        <input
          id="task-due"
          type="date"
          className={fieldClass}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>
      {!task && (
        <>
          <Field id="source-search" label="Find source document">
            <input
              id="source-search"
              type="search"
              className={fieldClass}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSourcePage(1);
              }}
            />
          </Field>
          {docs.loading && <Loading label="Loading source documents…" />}
          <ErrorNotice error={docs.error} retry={docs.reload} />
          <Field id="task-source" label="Source document">
            <select
              id="task-source"
              required
              className={fieldClass}
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            >
              <option value="">Choose a document</option>
              {documentId && !docs.data?.items.some((d) => d.id === documentId) && (
                <option value={documentId}>Selected document ({documentId})</option>
              )}
              {docs.data?.items.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          </Field>
          {docs.data && (
            <Pager
              page={docs.data.page}
              total={docs.data.total}
              pageSize={docs.data.pageSize}
              onChange={setSourcePage}
            />
          )}
        </>
      )}
      <ErrorNotice error={action.error} />
      <Button type="submit" disabled={action.pending || (!task && !documentId)}>
        {action.pending ? 'Saving…' : 'Save task'}
      </Button>
    </form>
  );
}
export function Tasks() {
  const filters = useFilters();
  const search = new URLSearchParams(filters.params);
  search.set('page', String(filters.page));
  const result = useResource<PageData<Task>>(`/tasks?${search}`);
  const action = useAction();
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const [remove, setRemove] = useState<Task | null>(null);
  return (
    <Page
      title="Tasks"
      description="Turn extracted action items into next steps. Each task stays linked to its source."
      actions={<Button onClick={() => setEditing('new')}>Add task</Button>}
    >
      <Panel>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="task-query" label="Search tasks">
            <input
              id="task-query"
              className={fieldClass}
              type="search"
              value={filters.params.get('q') || ''}
              onChange={(e) => filters.set('q', e.target.value)}
            />
          </Field>
          <Field id="task-status" label="Status">
            <select
              id="task-status"
              className={fieldClass}
              value={filters.params.get('status') || ''}
              onChange={(e) => filters.set('status', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field id="task-source-filter" label="Source document ID">
            <input
              id="task-source-filter"
              className={fieldClass}
              value={filters.params.get('sourceId') || ''}
              onChange={(e) => filters.set('sourceId', e.target.value)}
            />
          </Field>
        </div>
      </Panel>
      <ErrorNotice error={result.error} retry={result.reload} />
      <ErrorNotice error={action.error} />
      <Notice>{action.message}</Notice>
      {result.loading && <Loading />}
      {result.data && (
        <>
          {!result.data.items.length ? (
            <Empty>
              No tasks match your filters. Tasks extracted from your notes will appear here.
            </Empty>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {result.data.items.map((task) => (
                <li key={task.id}>
                  <Panel>
                    <div className="flex items-start gap-3">
                      <input
                        id={`complete-${task.id}`}
                        type="checkbox"
                        checked={task.status === 'completed'}
                        disabled={action.pending}
                        className="mt-1 h-5 w-5 shrink-0 accent-secondary"
                        onChange={() =>
                          void action.run(
                            (signal) =>
                              request<Task>(`/tasks/${key(task.id)}`, {
                                ...json('PATCH', {
                                  status: task.status === 'completed' ? 'pending' : 'completed',
                                }),
                                signal,
                              }),
                            result.reload,
                            'Task status updated.',
                          )
                        }
                      />
                      <label
                        htmlFor={`complete-${task.id}`}
                        className={`break-words text-lg font-semibold ${task.status === 'completed' ? 'line-through' : ''}`}
                      >
                        {task.description}
                      </label>
                    </div>
                    <p className="mt-3 text-sm capitalize">
                      {task.status} · {task.priority} priority ·{' '}
                      {task.dueDate ? `Due ${task.dueDate}` : 'No due date'}
                    </p>
                    <Link
                      className="mt-3 inline-block underline"
                      to={`/document/${key(task.source.documentId)}`}
                    >
                      {task.source.title}
                    </Link>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="secondary"
                        disabled={action.pending}
                        onClick={() => setEditing(task)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={action.pending}
                        onClick={() => setRemove(task)}
                      >
                        Delete
                      </Button>
                    </div>
                  </Panel>
                </li>
              ))}
            </ul>
          )}
          <Pager
            page={result.data.page}
            total={result.data.total}
            pageSize={result.data.pageSize}
            onChange={(p) => filters.set('page', String(p))}
          />
        </>
      )}
      {editing && (
        <Dialog
          title={editing === 'new' ? 'Add source-linked task' : 'Edit task'}
          onClose={() => setEditing(null)}
        >
          <TaskForm
            task={editing === 'new' ? undefined : editing}
            sourceId={filters.params.get('sourceId') || undefined}
            onDone={() => {
              setEditing(null);
              result.reload();
            }}
          />
        </Dialog>
      )}
      {remove && (
        <Dialog title="Delete task?" onClose={() => setRemove(null)}>
          <p className="mb-4">This removes the task, not its source document.</p>
          <ErrorNotice error={action.error} />
          <Button
            disabled={action.pending}
            onClick={() =>
              void action.run(
                (signal) => request<void>(`/tasks/${key(remove.id)}`, { method: 'DELETE', signal }),
                () => {
                  setRemove(null);
                  result.reload();
                },
                'Task deleted.',
              )
            }
          >
            Confirm deletion
          </Button>
        </Dialog>
      )}
    </Page>
  );
}
