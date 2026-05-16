import { Collapsible } from '@base-ui/react/collapsible';
import {
  Check,
  Copy,
  Image as ImageIcon,
  MessageSquareText,
  RefreshCcw,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConversionRecord,
  DesktopApi,
  PolishRulePresetSummary,
  ScreenshotContextImage,
} from '@toph/desktop-contracts';

import { useRelativeTime } from '../hooks/use-desktop-state';
import { ModalShell } from './modal';

const actionButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-transparent text-text-tertiary transition-all duration-200 ease-out hover:bg-white/8 hover:text-text-primary focus:bg-white/8 focus:text-text-primary focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-45';
const deleteButtonClass =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-accent-red/12 text-accent-red transition-all duration-200 ease-out hover:bg-accent-red/18 hover:text-accent-red focus:bg-accent-red/18 focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-45';

function toFileUrl(path: string) {
  return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
}

function formatByteSize(byteSize?: number) {
  if (typeof byteSize !== 'number') return 'unknown size';
  if (byteSize < 1024) return `${byteSize} B`;
  if (byteSize < 1024 * 1024) return `${(byteSize / 1024).toFixed(1)} KB`;
  return `${(byteSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatImageSize(width?: number, height?: number) {
  if (!width || !height) return 'unknown dimensions';
  return `${width}x${height}`;
}

function formatAbsoluteTime(timestamp: number | null | undefined) {
  if (!timestamp) return 'n/a';
  return new Date(timestamp).toLocaleString();
}

function formatDuration(durationMs: number | null | undefined) {
  if (durationMs === null || durationMs === undefined) return 'n/a';
  if (durationMs < 1_000) return `${durationMs} ms`;
  return `${(durationMs / 1_000).toFixed(1)} s`;
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return 'n/a';
  return `${(value * 100).toFixed(2)}%`;
}

export function DictationCard({
  conversion,
  rulePresets,
  client,
  diagnosticsEnabled,
}: {
  conversion: ConversionRecord;
  rulePresets: PolishRulePresetSummary[];
  client: DesktopApi;
  diagnosticsEnabled: boolean;
}) {
  const relativeTime = useRelativeTime(conversion.createdAt);
  const rulePresetTitle = rulePresets.find(
    (preset) => preset.id === conversion.rulePresetId,
  )?.title;
  const [justCopied, setJustCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [pendingAction, setPendingAction] = useState<'rerun' | 'delete' | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<{
    screenshot: ScreenshotContextImage;
    index: number;
  } | null>(null);
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
  const dictationPromptText = conversion.dictationPromptText?.trim() ?? '';
  const hasDictationPrompt = dictationPromptText.length > 0;
  const screenshots = conversion.screenshots ?? [];
  const hasScreenshots = screenshots.length > 0;
  const duplicateReferenceCount = screenshots.reduce(
    (count, screenshot) => count + (screenshot.duplicateReferences?.length ?? 0),
    0,
  );

  return (
    <>
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
            {hasDictationPrompt && (
              <div className="mt-3 flex max-w-full items-center gap-2 text-xs text-text-tertiary">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent-blue/18 bg-accent-blue/10 px-2.5 py-1 font-semibold text-accent-blue">
                  <MessageSquareText size={13} />
                  Prompt
                </span>
                <span className="min-w-0 truncate">{dictationPromptText}</span>
              </div>
            )}
            {hasScreenshots && (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent-cyan/18 bg-accent-cyan/10 px-2.5 py-1 text-xs font-semibold text-accent-cyan">
                  <ImageIcon size={13} />
                  {screenshots.length}
                </span>
                {screenshots.slice(0, 6).map((screenshot, index) => (
                  <span
                    key={screenshot.path}
                    className="relative block h-13 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30 shadow-[0_8px_28px_rgba(0,0,0,0.24)]"
                  >
                    <img
                      src={toFileUrl(screenshot.path)}
                      alt={`Screenshot context ${index + 1}`}
                      className="h-full w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
                      loading="lazy"
                    />
                    <span className="absolute right-1 bottom-1 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white/85">
                      {index + 1}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </Collapsible.Trigger>

          <Collapsible.Panel className="h-(--collapsible-panel-height) overflow-hidden transition-all duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
            <div className="pt-3">
              {conversion.kind === 'polished' && conversion.rulePresetId && (
                <p className="mt-2 mb-0 text-xs text-text-tertiary">
                  Polished with the{' '}
                  <span className="font-semibold text-text-secondary">
                    {rulePresetTitle ?? 'selected'}
                  </span>{' '}
                  rule
                </p>
              )}

              {hasDictationPrompt && (
                <section className="mt-4 rounded-xl border border-accent-blue/16 bg-accent-blue/8 px-3 py-3 text-sm text-text-secondary">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-accent-blue uppercase">
                    <MessageSquareText size={14} />
                    Dictation Prompt transcript
                  </div>
                  <p className="m-0 whitespace-pre-wrap leading-relaxed text-text-primary">
                    {dictationPromptText}
                  </p>
                  {diagnosticsEnabled && conversion.diagnostics && (
                    <dl className="mt-3 mb-0 grid grid-cols-[minmax(120px,auto)_1fr] gap-x-3 gap-y-1 border-t border-white/8 pt-2 text-xs">
                      <dt className="text-text-tertiary">prompt chars</dt>
                      <dd className="m-0">
                        {conversion.diagnostics.dictationPromptCharacterCount}
                      </dd>
                      <dt className="text-text-tertiary">prompt path</dt>
                      <dd className="m-0 break-all font-mono text-[11px]">
                        {conversion.diagnostics.dictationPromptTextPath ?? 'n/a'}
                      </dd>
                    </dl>
                  )}
                </section>
              )}

              {hasScreenshots && (
                <div className="mt-4 grid gap-3">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(132px,1fr))] gap-2">
                    {screenshots.map((screenshot, index) => (
                      <button
                        key={screenshot.path}
                        type="button"
                        className="group/thumb grid cursor-pointer gap-2 rounded-xl border border-white/8 bg-white/4 p-2 text-left transition-colors duration-200 hover:bg-white/7 focus:border-accent-blue/45 focus:outline-hidden"
                        aria-label={`Preview screenshot context ${index + 1}`}
                        onClick={() => setPreviewScreenshot({ screenshot, index })}
                      >
                        <span className="aspect-video overflow-hidden rounded-lg bg-black/35">
                          <img
                            src={toFileUrl(screenshot.path)}
                            alt={`Screenshot context ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-[1.03]"
                            loading="lazy"
                          />
                        </span>
                        <span className="flex items-center justify-between gap-2 text-[11px] text-text-tertiary">
                          <span>context-{String(index + 1).padStart(2, '0')}</span>
                          <span>{formatImageSize(screenshot.width, screenshot.height)}</span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {diagnosticsEnabled && (
                    <details className="group/details rounded-xl border border-white/8 bg-black/10 px-3 py-2 text-xs text-text-secondary">
                      <summary className="cursor-pointer list-none font-semibold text-text-primary marker:hidden">
                        Screenshot diagnostics
                        <span className="ml-2 text-text-tertiary group-open/details:hidden">
                          show details
                        </span>
                        <span className="ml-2 hidden text-text-tertiary group-open/details:inline">
                          hide details
                        </span>
                      </summary>
                      <div className="mt-3 grid gap-3">
                        {conversion.diagnostics && (
                          <dl className="m-0 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-3 gap-y-1">
                            <dt className="text-text-tertiary">session</dt>
                            <dd className="m-0 break-all font-mono text-[11px]">
                              {conversion.diagnostics.sessionId}
                            </dd>
                            <dt className="text-text-tertiary">output</dt>
                            <dd className="m-0 break-all font-mono text-[11px]">
                              {conversion.diagnostics.outputId}
                            </dd>
                            <dt className="text-text-tertiary">output kind</dt>
                            <dd className="m-0">{conversion.diagnostics.outputKind}</dd>
                            <dt className="text-text-tertiary">started</dt>
                            <dd className="m-0">
                              {formatAbsoluteTime(conversion.diagnostics.sessionStartedAt)}
                            </dd>
                            <dt className="text-text-tertiary">ended</dt>
                            <dd className="m-0">
                              {formatAbsoluteTime(conversion.diagnostics.sessionEndedAt)}
                            </dd>
                            <dt className="text-text-tertiary">duration</dt>
                            <dd className="m-0">
                              {formatDuration(conversion.diagnostics.sessionDurationMs)}
                            </dd>
                            <dt className="text-text-tertiary">prompt chars</dt>
                            <dd className="m-0">
                              {conversion.diagnostics.dictationPromptCharacterCount}
                            </dd>
                            <dt className="text-text-tertiary">prompt path</dt>
                            <dd className="m-0 break-all font-mono text-[11px]">
                              {conversion.diagnostics.dictationPromptTextPath ?? 'n/a'}
                            </dd>
                            <dt className="text-text-tertiary">screenshot count</dt>
                            <dd className="m-0">{conversion.diagnostics.screenshotCount}</dd>
                            <dt className="text-text-tertiary">similar skips</dt>
                            <dd className="m-0">{duplicateReferenceCount}</dd>
                            <dt className="text-text-tertiary">directory</dt>
                            <dd className="m-0 break-all font-mono text-[11px]">
                              {conversion.diagnostics.screenshotDirectory ?? 'n/a'}
                            </dd>
                          </dl>
                        )}

                        <div className="grid gap-2">
                          {screenshots.map((screenshot, index) => (
                            <dl
                              key={screenshot.path}
                              className="m-0 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-3 gap-y-1 border-t border-white/8 pt-2 first:border-t-0 first:pt-0"
                            >
                              <dt className="text-text-tertiary">image {index + 1}</dt>
                              <dd className="m-0 break-all font-mono text-[11px]">
                                {screenshot.path}
                              </dd>
                              <dt className="text-text-tertiary">captured</dt>
                              <dd className="m-0">{formatAbsoluteTime(screenshot.capturedAt)}</dd>
                              <dt className="text-text-tertiary">mime/detail</dt>
                              <dd className="m-0">
                                {screenshot.mimeType} / {screenshot.detail}
                              </dd>
                              <dt className="text-text-tertiary">dimensions</dt>
                              <dd className="m-0">
                                {formatImageSize(screenshot.width, screenshot.height)}
                              </dd>
                              <dt className="text-text-tertiary">file size</dt>
                              <dd className="m-0">{formatByteSize(screenshot.byteSize)}</dd>
                              {(screenshot.duplicateReferences ?? []).map(
                                (reference, referenceIndex) => (
                                  <div
                                    key={`${reference.capturedAt}-${referenceIndex}`}
                                    className="col-span-2 grid grid-cols-[minmax(110px,auto)_1fr] gap-x-3 gap-y-1 rounded-lg bg-white/4 px-2 py-1.5"
                                  >
                                    <dt className="text-text-tertiary">
                                      similar sample {referenceIndex + 1}
                                    </dt>
                                    <dd className="m-0">
                                      captured {formatAbsoluteTime(reference.capturedAt)}
                                    </dd>
                                    <dt className="text-text-tertiary">reference</dt>
                                    <dd className="m-0 break-all font-mono text-[11px]">
                                      {reference.referencePath}
                                    </dd>
                                    <dt className="text-text-tertiary">mean diff</dt>
                                    <dd className="m-0">
                                      {formatPercent(reference.meanAbsoluteDifference)}
                                    </dd>
                                    <dt className="text-text-tertiary">changed pixels</dt>
                                    <dd className="m-0">
                                      {formatPercent(reference.changedPixelRatio)}
                                    </dd>
                                  </div>
                                ),
                              )}
                            </dl>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}
                </div>
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

      {previewScreenshot && (
        <ModalShell
          eyebrow="Screenshot context"
          title={`Screenshot context ${previewScreenshot.index + 1}`}
          description={`${formatImageSize(previewScreenshot.screenshot.width, previewScreenshot.screenshot.height)} / ${formatByteSize(previewScreenshot.screenshot.byteSize)} / ${formatAbsoluteTime(previewScreenshot.screenshot.capturedAt)}`}
          size="lg"
          onClose={() => setPreviewScreenshot(null)}
        >
          <div className="grid h-full grid-rows-[minmax(0,1fr)_auto] gap-3 bg-black/14 p-4">
            <div className="min-h-0 overflow-hidden rounded-2xl border border-white/8 bg-black/50">
              <img
                src={toFileUrl(previewScreenshot.screenshot.path)}
                alt={`Screenshot context ${previewScreenshot.index + 1} enlarged`}
                className="h-full w-full object-contain"
              />
            </div>
            <dl className="m-0 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-2xl border border-white/8 bg-white/4 px-4 py-3 text-xs text-text-secondary">
              <dt className="text-text-tertiary">path</dt>
              <dd className="m-0 break-all font-mono text-[11px]">
                {previewScreenshot.screenshot.path}
              </dd>
              <dt className="text-text-tertiary">captured</dt>
              <dd className="m-0">{formatAbsoluteTime(previewScreenshot.screenshot.capturedAt)}</dd>
              <dt className="text-text-tertiary">size</dt>
              <dd className="m-0">
                {formatImageSize(
                  previewScreenshot.screenshot.width,
                  previewScreenshot.screenshot.height,
                )}{' '}
                / {formatByteSize(previewScreenshot.screenshot.byteSize)}
              </dd>
            </dl>
          </div>
        </ModalShell>
      )}
    </>
  );
}
