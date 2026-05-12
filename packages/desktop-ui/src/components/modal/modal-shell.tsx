import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

type ModalShellSize = 'sm' | 'lg';

const modalSizeClass: Record<ModalShellSize, string> = {
  sm: 'max-h-[86vh] max-w-md',
  lg: 'h-[86vh] max-w-5xl',
};

function getFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
}

export function ModalShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  closeOnEscape = true,
  size = 'sm',
  titleId,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  closeOnEscape?: boolean;
  size?: ModalShellSize;
  titleId?: string;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const generatedTitleId = useId();
  const generatedDescriptionId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const descriptionId = description
    ? `${resolvedTitleId}-${generatedDescriptionId}-description`
    : undefined;

  useEffect(() => {
    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus({ preventScroll: true });

    return () => {
      previousActiveElement?.focus({ preventScroll: true });
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && closeOnEscape && !closeDisabled) {
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = getFocusableElements(dialog);
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (
      event.shiftKey &&
      (!activeElement ||
        activeElement === dialog ||
        activeElement === firstElement ||
        !dialog.contains(activeElement))
    ) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#11131f]/72 px-5 backdrop-blur-sm">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedTitleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`flex w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-canvas-elevated shadow-[0_24px_80px_rgba(0,0,0,0.45)] ${modalSizeClass[size]}`}
      >
        <div className="flex items-start justify-between gap-5 border-b border-white/6 px-6 pt-6 pb-5">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
              {eyebrow}
            </p>
            <h2
              id={resolvedTitleId}
              className="m-0 font-display text-2xl font-bold tracking-[-0.03em] text-text-primary"
            >
              {title}
            </h2>
            {description && (
              <p
                id={descriptionId}
                className="mt-2 mb-0 max-w-2xl text-sm leading-relaxed text-text-secondary"
              >
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-white/5 text-text-secondary transition-colors duration-200 hover:bg-white/10 hover:text-text-primary disabled:cursor-default disabled:opacity-45 disabled:hover:bg-white/5 disabled:hover:text-text-secondary"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/6 px-6 py-4">
            {footer}
          </div>
        )}
      </section>
    </div>
  );
}
