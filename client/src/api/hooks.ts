import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Budget, Funding } from './types';
import { useToast } from '../components/ui';

export function useFundingList(quarter = 'all') {
  return useQuery({
    queryKey: ['funding', quarter],
    queryFn: () => api<{ items: Funding[]; budget: Budget | null }>(`/funding?quarter=${quarter}`),
  });
}

/**
 * Runs a server action, shows a toast on success, keeps the error message,
 * and refreshes every cached query so all screens show the new state.
 */
export function useAction() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run<T>(fn: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      await qc.invalidateQueries();
      if (success) toast(success);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      return undefined;
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
