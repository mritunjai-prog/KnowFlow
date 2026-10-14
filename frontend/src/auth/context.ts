import { createContext, useContext } from 'react';
import type { Session, User } from '../api/types';
type Auth = {
  user: User | null;
  loading: boolean;
  error: Error | null;
  accept: (session: Session) => void;
  reload: () => void;
  logout: () => Promise<void>;
};
export const Context = createContext<Auth | null>(null);
export function useAuth() {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider is required');
  return context;
}
