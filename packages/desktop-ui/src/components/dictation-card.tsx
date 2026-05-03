import { useCallback, useEffect, useRef, useState } from 'react';

import { Collapsible } from '@base-ui/react/collapsible';
import { Menu } from '@base-ui/react/menu';
import type { ConversionRecord } from '@toph/desktop-contracts';

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

  const handleTransform = useCallback(() => {}, []);
  const handleRerun = useCallback(() => {}, []);
  const handlePasteAgain = useCallback(() => {}, []);
  const handleDelete = useCallback(() => {}, []);

  const isFailed = conversion.pasteStatus === 'failed';
  const statusLabel = pasteStatusLabel[conversion.pasteStatus] ?? conversion.pasteStatus;
  const statusTone = pasteStatusTone[conversion.pasteStatus] ?? 'text-text-tertiary';

  return (
    <Collapsible.Root defaultOpen={false}>
      <article
        className={`group rounded-2xl border bg-white/3 p-4 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-px ${isFailed ? 'border-l-2 border-accent-red/30 border-t-white/6 border-r-white/6 border-b-white/6' : 'border-white/6 hover:border-white/10'}`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-sm text-text-tertiary">{relativeTime}</span>
          <span className={`text-sm font-medium ${statusTone}`}>
            {statusLabel}
          </span>
        </div>

        <Collapsible.Trigger
          className="m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-left outline-hidden"
          render={<button type="button" />}
        >
          <p className="m-0 text-[0.95rem] leading-relaxed text-text-primary line-clamp-3 group-has-data-panel-open:line-clamp-none">
            {conversion.text}
          </p>
        </Collapsible.Trigger>

        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          <div className="pt-2">
            {conversion.pasteDetail && (
              <p className="m-0 text-sm text-text-secondary">
                {conversion.pasteDetail}
              </p>
            )}
          </div>
        </Collapsible.Panel>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className={`inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent px-4 py-1.5 text-sm font-medium transition-all duration-200 ease-out hover:-translate-y-px ${justCopied ? (copyFailed ? 'bg-accent-red/14 text-accent-red' : 'bg-accent-green/14 text-accent-green') : 'bg-white/6 text-text-primary hover:bg-white/10'}`}
            onClick={handleCopy}
          >
            {justCopied ? (copyFailed ? 'Copy failed' : 'Copied') : 'Copy'}
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center rounded-full border border-transparent bg-white/6 px-4 py-1.5 text-sm font-medium text-text-primary transition-all duration-200 ease-out hover:-translate-y-px hover:bg-white/10"
            onClick={handleTransform}
          >
            Transform
          </button>

          <div className="ml-auto">
            <Menu.Root>
              <Menu.Trigger className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-text-tertiary transition-colors duration-150 hover:bg-white/8 hover:text-text-primary data-popup-open:bg-white/8 data-popup-open:text-text-primary">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="3" cy="8" r="1.5" />
                  <circle cx="8" cy="8" r="1.5" />
                  <circle cx="13" cy="8" r="1.5" />
                </svg>
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner className="outline-hidden" sideOffset={6}>
                  <Menu.Popup className="menu-popup-surface origin-(--transform-origin) rounded-xl py-1.5 text-text-primary transition-[transform,opacity] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
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
        </div>
      </article>
    </Collapsible.Root>
  );
}
