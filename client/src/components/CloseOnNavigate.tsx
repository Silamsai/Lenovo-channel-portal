'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * A <details> dropdown that closes when the page changes or when clicking outside it.
 * Needed because the top bar stays on screen during client-side navigation.
 */
export function CloseOnNavigate({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const path = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [path, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return (
    <details ref={ref} className={className}>
      {children}
    </details>
  );
}
