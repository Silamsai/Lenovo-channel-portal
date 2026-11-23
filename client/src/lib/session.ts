import { cache } from 'react';
import { redirect } from 'next/navigation';
import { ApiError, sessionToken, API_URL } from './api';
import type { Role, User } from './types';

/** The signed-in user for this request (cached per request), or null. */
export const getUser = cache(async (): Promise<User | null> => {
  const token = await sessionToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as User;
  } catch {
    throw new ApiError(503, 'The backend API is not reachable. Is it running?');
  }
});

/** Home page for each role. */
export const homeFor = (role: Role) => (role === 'ADMIN' ? '/admin' : '/');

/**
 * Use at the top of every page: sends signed-out visitors to the login page and
 * people with the wrong role to their own home. The backend enforces the same rules.
 */
export async function requireUser(...roles: Role[]): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/login');
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

