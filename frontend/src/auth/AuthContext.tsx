import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { request, setCsrfToken, json } from '../api/client';
import type { Session } from '../api/types';
import { useResource } from '../api/hooks';
import { ErrorNotice, Loading, Page, Forbidden } from '../components/ui/Feedback';
import { Context, useAuth } from './context';
export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useResource<Session>('/session');
  const { reload } = session;
  const [override, setOverride] = useState<Session | null>(null);
  const user = (override || session.data)?.user || null;
  const accept = (value: Session) => {
    setCsrfToken(value.csrfToken);
    setOverride(value);
  };
  useEffect(() => {
    if (session.data) {
      setCsrfToken(session.data.csrfToken);
      setOverride(null);
    }
  }, [session.data]);
  useEffect(() => {
    const expired = () => {
      setOverride({ user: null, csrfToken: '' });
      setCsrfToken('');
      reload();
    };
    window.addEventListener('knowflow:session-expired', expired);
    return () => window.removeEventListener('knowflow:session-expired', expired);
  }, [reload]);
  const logout = async () => {
    const value = await request<Session>('/auth/logout', json('POST'));
    accept(value);
  };
  return (
    <Context.Provider
      value={{
        user,
        loading: session.loading && !session.data && !override,
        error: session.error,
        accept,
        reload: session.reload,
        logout,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <Loading label="Checking your session…" />;
  if (auth.error)
    return (
      <Page
        title="Service unavailable"
        description="The backend is not connected or cannot be reached. No session has been simulated."
      >
        <ErrorNotice error={auth.error} retry={auth.reload} />
      </Page>
    );
  if (!auth.user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (admin && auth.user.role !== 'admin') return <Forbidden />;
  return <Outlet />;
}
