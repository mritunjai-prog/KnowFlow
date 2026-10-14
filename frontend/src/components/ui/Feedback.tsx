import { Component, useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { Button } from './Button';
import { ApiError } from '../../api/client';
export const fieldClass =
  'w-full min-w-0 rounded-lg border border-primary/30 bg-white/80 px-3 py-2.5 text-primary focus-visible:outline-2 focus-visible:outline-secondary disabled:opacity-60';
export function Page({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-8"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1
            tabIndex={-1}
            className="break-words font-heading text-3xl font-bold tracking-tight text-primary sm:text-4xl"
          >
            {title}
          </h1>
          {description && <p className="mt-2 max-w-2xl text-primary/80">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </motion.div>
  );
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`min-w-0 break-words rounded-2xl border border-primary/15 bg-sand/90 p-4 shadow-sm backdrop-blur-xl sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 p-4 text-primary">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 motion-safe:animate-spin" />
      {label}
    </p>
  );
}
export function ErrorNotice({ error, retry }: { error: Error | null; retry?: () => void }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="[overflow-wrap:anywhere] rounded-xl border border-secondary/40 bg-white/90 p-4 text-primary"
    >
      <p className="flex items-start gap-2">
        <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-secondary" />
        {error.message}
      </p>
      {error instanceof ApiError && Object.keys(error.fields).length > 0 && (
        <ul className="mt-2 list-inside list-disc">
          {Object.entries(error.fields).map(([field, message]) => (
            <li key={field}>
              {field}: {message}
            </li>
          ))}
        </ul>
      )}
      {retry && (
        <Button variant="secondary" onClick={retry} className="mt-3">
          Try again
        </Button>
      )}
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm text-primary">
      {children}
    </p>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <Panel>
      <p className="py-8 text-center text-primary/80">{children}</p>
    </Panel>
  );
}
export function Field({
  label,
  id,
  children,
  hint,
}: {
  label: string;
  id: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="break-words text-sm text-primary/80">
          {hint}
        </p>
      )}
    </div>
  );
}
export function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Previous
      </Button>
      <span className="text-sm">
        Page {page} · {total} results
      </span>
      <Button
        variant="secondary"
        disabled={page * pageSize >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-sand p-6 text-primary shadow-xl backdrop:bg-primary/50"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="dialog-title" className="text-xl font-bold">
          {title}
        </h2>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {children}
    </dialog>
  );
}
export function NotFound() {
  return (
    <Page title="Page not found" description="This address does not match a KnowFlow page.">
      <Link className="underline" to="/dashboard">
        Return to your dashboard
      </Link>
    </Page>
  );
}
export function Forbidden() {
  return (
    <Page
      title="Access denied"
      description="Your account does not have permission to view this page."
    >
      <Link className="underline" to="/dashboard">
        Return to your dashboard
      </Link>
    </Page>
  );
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="my-4">Reload and check the latest saved state before retrying an action.</p>
        <Button onClick={() => window.location.reload()}>Reload KnowFlow</Button>
      </main>
    ) : (
      this.props.children
    );
  }
}
