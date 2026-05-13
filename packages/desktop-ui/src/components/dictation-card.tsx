import { Collapsible } from '@base-ui/react/collapsible';
import { Check, Copy, RefreshCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConversionRecord,
  DesktopApi,
  PolishRulePresetSummary,
} from '@toph/desktop-contracts';

import { useRelativeTime } from '../hooks/use-desktop-state';

const actionButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-text-tertiary transition-all duration-200 ease-out hover:bg-white/8 hover:text-text-primary focus:bg-white/8 focus:text-text-primary focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-45';
const deleteButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-accent-red/12 text-accent-red transition-all duration-200 ease-out hover:bg-accent-red/18 hover:text-accent-red focus:bg-accent-red/18 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-45';

export function DictationCard({
  conversion,
  rulePresets,
  client,
}: {
  conversion: ConversionRecord;
  rulePresets: PolishRulePresetSummary[];
  client: DesktopApi;
}) {
  const relativeTime = useRelativeTime(conversion.createdAt);
  const rulePresetTitle = rulePresets.find(
    (preset) => preset.id === conversion.rulePresetId,
  )?.title;
  const [justCopied, setJustCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [pendingAction, setPendingAction] = useState<'rerun' | 'delete' | null>(null);
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

  const handleRerun = useCallback(() => {
    setPendingAction('rerun');
    void client
      .rerunConversion(conversion.id)
      .catch((error: unknown) => {
        console.error('Toph could not rerun the conversion.', error);
      })
      .finally(() => {
        setPendingAction(null);
      });
  }, [client, conversion.id]);

  const handleDelete = useCallback(() => {
    setPendingAction('delete');
    void client.deleteConversion(conversion.id).catch((error: unknown) => {
      console.error('Toph could not delete the conversion.', error);
      setPendingAction(null);
    });
  }, [client, conversion.id]);

  const isFailed = conversion.pasteStatus === 'failed';

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
            {isFailed && (
              <span className="rounded-full border border-accent-red/18 bg-accent-red/12 px-2 py-0.5 text-xs font-semibold text-accent-red">
                Needs rerun
              </span>
            )}
          </div>

          <p className="m-0 pr-24 text-[0.95rem] leading-relaxed text-text-primary line-clamp-2 group-has-data-panel-open:line-clamp-none">
            {conversion.text}
          </p>
        </Collapsible.Trigger>

        <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
          {conversion.kind === 'polished' && conversion.rulePresetId && (
            <div className="pt-3">
              <p className="mt-2 mb-0 text-xs text-text-tertiary">
                Polished with the{' '}
                <span className="font-semibold text-text-secondary">
                  {rulePresetTitle ?? 'selected'}
                </span>{' '}
                rule
              </p>
            </div>
          )}
        </Collapsible.Panel>

        {/* Hover Action Dock */}
        <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-has-focus-visible:opacity-100 group-has-data-popup-open:opacity-100">
          <button
            type="button"
            className={actionButtonClass}
            onClick={handleCopy}
            title="Copy"
            aria-label="Copy transcript"
            disabled={pendingAction !== null}
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
            onClick={handleRerun}
            title="Rerun workflow"
            aria-label="Rerun workflow"
            disabled={pendingAction !== null}
          >
            <RefreshCcw
              size={15}
              className={pendingAction === 'rerun' ? 'animate-spin' : undefined}
            />
          </button>

          <button
            type="button"
            className={deleteButtonClass}
            onClick={handleDelete}
            title="Delete"
            aria-label="Delete conversion"
            disabled={pendingAction !== null}
          >
            {pendingAction === 'delete' ? <X size={15} /> : <Trash2 size={15} />}
          </button>
        </div>
      </article>
    </Collapsible.Root>
  );
}
