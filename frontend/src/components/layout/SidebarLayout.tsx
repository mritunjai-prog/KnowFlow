import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Clock,
  MessageSquare,
  CheckSquare,
  Settings,
  ScanLine,
  Plus,
  FileText,
  Menu,
  Users,
  Shield,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { LineSidebar } from '../ui/LineSidebar';
import { ShaderBackground } from '../ui/ShaderBackground';
import { Button } from '../ui/Button';
import { Dialog, ErrorNotice } from '../ui/Feedback';
import { useAuth } from '../../auth/context';
import { useAction } from '../../api/hooks';
export function SidebarLayout() {
  const [mobile, setMobile] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const auth = useAuth();
  const action = useAction();
  const navigate = useNavigate();
  const location = useLocation();
  const items = [
    { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Capture', to: '/capture', icon: Plus },
    { label: 'Library', to: '/library', icon: FileText },
    { label: 'Meetings', to: '/meetings', icon: Users },
    { label: 'Timeline', to: '/timeline', icon: Clock },
    { label: 'Tasks', to: '/tasks', icon: CheckSquare },
    { label: 'Assistant', to: '/assistant', icon: MessageSquare },
    { label: 'Sharing', to: '/sharing', icon: Users },
    { label: 'Settings', to: '/settings', icon: Settings },
    ...(auth.user?.role === 'admin' ? [{ label: 'Admin', to: '/admin', icon: Shield }] : []),
  ];
  useEffect(() => {
    const timer = setTimeout(() => {
      document.querySelector<HTMLElement>('main h1')?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname]);
  return (
    <div className="relative flex h-dvh min-h-0 overflow-hidden text-primary">
      <ShaderBackground />
      <a
        href="#main-content"
        className="sr-only z-50 rounded bg-white p-3 focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>
      {expanded && (
        <aside className="relative z-10 hidden w-64 shrink-0 flex-col overflow-y-auto bg-primary/95 p-4 text-sand lg:flex">
          <div className="mb-8 flex items-center gap-3 p-3 font-heading text-xl font-bold">
            <ScanLine aria-hidden="true" />
            KnowFlow
          </div>
          <LineSidebar items={items} />
          <p className="mt-auto break-words p-3 pt-8 text-sm">
            {auth.user?.name}
            <br />
            Personal knowledge hub
          </p>
        </aside>
      )}
      {mobile && (
        <Dialog title="Navigation" onClose={() => setMobile(false)}>
          <div className="rounded-xl bg-primary p-3">
            <LineSidebar items={items} onNavigate={() => setMobile(false)} />
          </div>
        </Dialog>
      )}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-primary/15 bg-sand/95 p-3">
          <div className="flex items-center gap-2">
            <Button
              className="lg:hidden"
              variant="ghost"
              aria-label="Open navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu aria-hidden="true" />
            </Button>
            <Button
              className="hidden lg:inline-flex"
              variant="ghost"
              aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <PanelLeftClose /> : <PanelLeftOpen />}
            </Button>
            <span className="font-heading font-bold">KnowFlow</span>
          </div>
          <Button
            variant="ghost"
            disabled={action.pending}
            onClick={() =>
              void action.run(
                () => auth.logout(),
                () => navigate('/login', { replace: true }),
              )
            }
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            Sign out
          </Button>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <ErrorNotice error={action.error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
