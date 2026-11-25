'use client';

/**
 * A button that opens its children (usually a form) in a centred floating window.
 * The window closes on ✕, Esc, a click on the backdrop, a <DialogCancel>, or when a
 * Server Action redirects to a new URL (e.g. "?saved=created" after a successful create).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';

export function ModalTrigger({
  label,
  title,
  sub,
  children,
  className = 'btn',
}: {
  label: ReactNode;
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();
  // Bumped on each successful navigation so the form inside starts empty next time.
  const [round, setRound] = useState(0);
  // The window is portalled to <body> so its form never nests inside a surrounding form (e.g. a filter bar).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (ref.current?.open) {
      ref.current.close();
      setRound((r) => r + 1);
    }
  }, [pathname, search]);

  function open() {
    // Drop a stale "?saved=…" so the redirect after this submit is a real URL change.
    const url = new URL(window.location.href);
    if (url.searchParams.has('saved')) {
      url.searchParams.delete('saved');
      window.history.replaceState(window.history.state, '', url);
    }
    ref.current?.showModal();
  }

  return (
    <>
      <button type="button" className={className} onClick={open}>
        {label}
      </button>
      {mounted &&
        createPortal(
          <dialog
            ref={ref}
            className="modal modal-wide"
            aria-labelledby={`modal-${title}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) e.currentTarget.close();
            }}
          >
            <div className="modal-body">
              <button type="button" className="modal-close" aria-label="Close" onClick={() => ref.current?.close()}>
                ×
              </button>
              <div className="modal-head">
                <h2 id={`modal-${title}`}>{title}</h2>
                {sub && <p className="muted">{sub}</p>}
              </div>
              <div key={round}>{children}</div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}

/** Closes the floating window it sits in. */
export function DialogCancel({ children = 'Cancel' }: { children?: ReactNode }) {
  return (
    <button type="button" className="btn secondary" onClick={(e) => e.currentTarget.closest('dialog')?.close()}>
      {children}
    </button>
  );
}
