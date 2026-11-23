import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import type { User } from '../api/types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api<User>('/auth/me');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: Infinity,
    retry: false,
  });

  const value: AuthValue = {
    user: me.data ?? null,
    loading: me.isLoading,
    async login(email, password) {
      const user = await api<User>('/auth/login', { body: { email, password } });
      qc.clear();
      qc.setQueryData(['me'], user);
      return user;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST' });
      qc.clear();
      qc.setQueryData(['me'], null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** The signed-in user. Only use inside routes guarded by RequireAuth. */
export function useUser() {
  const { user } = useAuth();
  if (!user) throw new Error('No signed-in user');
  return user;
}
