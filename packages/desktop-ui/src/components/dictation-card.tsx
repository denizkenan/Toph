import { useCallback, useEffect, useRef, useState } from 'react';

import { Collapsible } from '@base-ui/react/collapsible';
import { Menu } from '@base-ui/react/menu';
import type { ConversionRecord } from '@toph/desktop-contracts';
import { Check, Copy, Sparkles, X } from 'lucide-react';

import { useRelativeTime } from '../hooks/use-desktop-state';

const pasteStatusLabel: Record<string, string> = {
  success: 'Pasted',
  failed: 'Paste failed',
  'clipboard-only': 'Copied to clipboard',
  idle: 'Idle',
};

const pasteStatusTone: Record<string, string> = {
  success: 'text-accent-green',
  failed: 'text-accent-red',
  'clipboard-only': 'text-text-secondary',
  idle: 'text-text-tertiary',
};

const menuItemClass =
  'flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-primary outline-hidden select-none transition-colors duration-100 data-[highlighted]:bg-white/8 data-[highlighted]:text-text-primary';

const actionButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-text-tertiary transition-all duration-200 ease-out hover:bg-white/8 hover:text-text-primary focus:bg-white/8 focus:text-text-primary focus:outline-hidden';

const menuPopupSurfaceClass =
  'rounded-xl border border-white/10 bg-[linear-gradient(180deg,rgba(54,58,79,0.98),rgba(36,39,58,0.98))] py-1.5 text-text-primary shadow-menu backdrop-blur-[18px]';

export function DictationCard({
  conversion,
}: {
  conversion: ConversionRecord;
}) {
  const relativeTime = useRelativeTime(conversion.createdAt);
  const [justCopied, setJustCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }

    navigator.clipboard
      .writeText(conversion.text)
      .then(
        () => {
          setJustCopied(true);
          setCopyFailed(false);
        },
        () => {
          setJustCopied(true);
          setCopyFailed(true);
        },
      )
      .finally(() => {
        copyTimerRef.current = setTimeout(() => {
          setJustCopied(false);
          setCopyFailed(false);
          copyTimerRef.current = null;
        }, 1500);
      });
  }, [conversion.text]);

  const handleTransform = useCallback(() => {
    console.log("[Toph] Transform:", conversion.id);
  }, [conversion.id]);

  const handleRerun = useCallback(() => {
    console.log("[Toph] Rerun workflow:", conversion.id);
  }, [conversion.id]);

  const handlePasteAgain = useCallback(() => {
    console.log("[Toph] Paste again:", conversion.id);
  }, [conversion.id]);

  const handleDelete = useCallback(() => {
    console.log("[Toph] Delete:", conversion.id);
  }, [conversion.id]);

  const isFailed = conversion.pasteStatus === 'failed';
  const statusLabel = pasteStatusLabel[conversion.pasteStatus] ?? conversion.pasteStatus;
  const statusTone = pasteStatusTone[conversion.pasteStatus] ?? 'text-text-tertiary';

  return (
    <Collapsible.Root defaultOpen={false}>
      <article
        className={`group relative flex flex-col px-5 py-4 transition-colors duration-200 ease-out hover:bg-white/4 ${isFailed ? 'border-l-2 border-l-accent-red/50' : 'border-l-2 border-l-transparent'}`}
      >
        <Collapsible.Trigger
          className="m-0 flex w-full cursor-pointer flex-col border-0 bg-transparent p-0 text-left outline-hidden"
          render={<button type="button" />}
        >
          <div className="mb-1.5 flex items-center gap-3">
            <span className="text-sm text-text-tertiary">{relativeTime}</span>
            <span className={`text-sm font-medium ${statusTone}`}>
              {statusLabel}
            </span>
            {conversion.kind === 'polished' && conversion.promptId && (
              <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-xs font-medium text-text-tertiary">
                Polish: {conversion.promptId}
              </span>
            )}
          </div>

          <p className="m-0 pr-24 text-[0.95rem] leading-relaxed text-text-primary line-clamp-2 group-has-data-panel-open:line-clamp-none">
            {conversion.text}
          </p>
        </Collapsible.Trigger>

        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="pt-3">
            {conversion.pasteDetail && (
              <p className="m-0 text-sm text-text-secondary">
                {conversion.pasteDetail}
              </p>
            )}
            {conversion.kind === 'polished' && conversion.promptId && (
              <p className="mt-2 mb-0 text-xs text-text-tertiary">
                Polished with prompt <span className="font-semibold text-text-secondary">{conversion.promptId}</span>
                {conversion.promptHash ? ` (${conversion.promptHash.slice(0, 12)})` : ''}
              </p>
            )}
          </div>
        </Collapsible.Panel>

        {/* Hover Action Dock */}
        <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-has-data-popup-open:opacity-100">
          <button
            type="button"
            className={actionButtonClass}
            onClick={handleCopy}
            title="Copy"
          >
            {justCopied ? (
              copyFailed ? (
                <X size={15} className="text-accent-red" />
              ) : (
                <Check size={15} className="text-accent-green" />
              )
            ) : (
              <Copy size={15} />
            )}
          </button>

          <button
            type="button"
            className={actionButtonClass}
            onClick={handleTransform}
            title="Transform"
          >
            <Sparkles size={15} />
          </button>

          <Menu.Root>
            <Menu.Trigger className={actionButtonClass}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner className="outline-hidden" sideOffset={6}>
                <Menu.Popup className={`${menuPopupSurfaceClass} origin-(--transform-origin) transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0`}>
                  <Menu.Item className={menuItemClass} onClick={handleRerun}>
                    Rerun workflow
                  </Menu.Item>
                  <Menu.Item className={menuItemClass} onClick={handlePasteAgain}>
                    Paste again
                  </Menu.Item>
                  <Menu.Separator className="mx-3 my-1.5 h-px bg-white/8" />
                  <Menu.Item
                    className={`${menuItemClass} text-accent-red data-highlighted:text-accent-red`}
                    onClick={handleDelete}
                  >
                    Delete
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </article>
    </Collapsible.Root>
  );
}
