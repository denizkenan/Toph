import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react';

import type {
  DesktopApi,
  DictionaryEntryDraft,
  DictionaryEntrySummary,
  PolishRulePresetDraft,
  PolishRulePresetSummary,
} from '@toph/desktop-contracts';

import { Button } from '../button';
import { ModalShell } from '../modal';
import { SettingsIcon, SettingsRow, SettingsSection, SettingsSwitch } from './settings-controls';

const hiddenScrollbarClass = '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

function AutoGrowTextarea({
  className = '',
  value,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      rows={1}
      className={`box-border resize-none overflow-hidden ${className}`}
    />
  );
}

function RulesModal({
  rulePresets,
  activeRulePresetId,
  disabled,
  client,
  onClose,
}: {
  rulePresets: PolishRulePresetSummary[];
  activeRulePresetId: string | null;
  disabled: boolean;
  client: DesktopApi;
  onClose: () => void;
}) {
  const firstId = activeRulePresetId ?? rulePresets[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(firstId);
  const selected = rulePresets.find((preset) => preset.id === selectedId) ?? null;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected?.isBuiltin) {
      setTitle(selected.title);
      setBody(selected.body);
      return;
    }

    if (selected) {
      setTitle(selected.title);
      setBody(selected.body);
      return;
    }

    if (!selected) {
      setTitle('');
      setBody('');
    }
  }, [selected]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not work. Very rude.');
    } finally {
      setBusy(false);
    }
  };

  const createCustom = async (draft: PolishRulePresetDraft) =>
    run(async () => {
      await client.createPolishRulePreset(draft);
    });

  return (
    <ModalShell
      eyebrow="Rules"
      title="Manage writing rules"
      titleId="rules-modal-title"
      description="Choose how Toph cleans up dictation. Built-ins are read-only, but you can duplicate the vibe and make it yours."
      size="lg"
      onClose={onClose}
      footer={
        <>
          {selected?.isBuiltin && (
            <Button
              onClick={() =>
                void createCustom({ title: `${selected.title} copy`, body: selected.body })
              }
              disabled={disabled || busy}
            >
              Duplicate
            </Button>
          )}
          {selected && !selected.isBuiltin && (
            <Button
              variant="danger"
              onClick={() => void run(() => client.deletePolishRulePreset(selected.id))}
              disabled={disabled || busy || activeRulePresetId === selected.id}
            >
              Delete
            </Button>
          )}
          {selected && !selected.isBuiltin && (
            <Button
              onClick={() =>
                void run(() => client.updatePolishRulePreset(selected.id, { title, body }))
              }
              disabled={disabled || busy}
            >
              Save
            </Button>
          )}
          {!selected && (
            <Button onClick={() => void createCustom({ title, body })} disabled={disabled || busy}>
              Create
            </Button>
          )}
          {selected && (
            <Button
              variant="primary"
              onClick={() => void run(() => client.setActivePolishRulePreset(selected.id))}
              disabled={disabled || busy || activeRulePresetId === selected.id}
            >
              Use this preset
            </Button>
          )}
        </>
      }
    >
      <div className="grid h-full min-h-0 overflow-hidden grid-cols-[17rem_minmax(0,1fr)] max-[820px]:grid-cols-1 max-[820px]:grid-rows-[minmax(0,14rem)_minmax(0,1fr)]">
        <aside
          className={`min-h-0 overscroll-contain overflow-y-auto border-r border-white/6 p-4 max-[820px]:border-r-0 max-[820px]:border-b ${hiddenScrollbarClass}`}
        >
          <Button
            className="mb-3 w-full"
            onClick={() => {
              setSelectedId(null);
              setTitle('My rules');
              setBody('');
            }}
          >
            + New custom rules
          </Button>
          <div className="grid gap-2">
            {rulePresets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`rounded-2xl border px-3 py-3 text-left transition-colors duration-200 ${selectedId === preset.id ? 'border-accent-blue/45 bg-accent-blue/10' : 'border-white/6 bg-white/3 hover:bg-white/6'}`}
                onClick={() => setSelectedId(preset.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-text-primary">{preset.title}</span>
                  {activeRulePresetId === preset.id && (
                    <span className="rounded-full bg-accent-green/12 px-2 py-0.5 text-[11px] font-semibold text-accent-green">
                      Active
                    </span>
                  )}
                </div>
                <span className="mt-1 block text-xs text-text-tertiary">
                  {preset.isBuiltin ? 'Built-in preset' : 'Custom preset'}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <div className={`min-h-0 overscroll-contain overflow-y-auto p-6 ${hiddenScrollbarClass}`}>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-text-secondary">
              Title
              <input
                className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-text-primary outline-hidden focus:border-accent-blue/70"
                value={title}
                disabled={!!selected?.isBuiltin || disabled || busy}
                onChange={(event) => setTitle(event.currentTarget.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-text-secondary">
              Rules Markdown
              <AutoGrowTextarea
                className="min-h-56 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm leading-relaxed text-text-primary outline-hidden focus:border-accent-blue/70"
                value={body}
                disabled={!!selected?.isBuiltin || disabled || busy}
                onChange={(event) => setBody(event.currentTarget.value)}
              />
            </label>
            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

function DictionaryModal({
  entries,
  disabled,
  client,
  onClose,
}: {
  entries: DictionaryEntrySummary[];
  disabled: boolean;
  client: DesktopApi;
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(entries[0]?.id ?? null);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const [term, setTerm] = useState('');
  const [hint, setHint] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) {
      return;
    }
    setTerm(selected.term);
    setHint(selected.hint ?? '');
    setEnabled(selected.enabled);
  }, [selected]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Dictionary update failed. The words rebelled.',
      );
    } finally {
      setBusy(false);
    }
  };

  const draft = (): DictionaryEntryDraft => ({ term, hint: hint.trim() ? hint : null, enabled });

  return (
    <ModalShell
      eyebrow="Dictionary"
      title="Teach Toph your words"
      titleId="dictionary-modal-title"
      description="Add names, acronyms, product terms, and hints. I will use them cautiously during polish, not like a chaotic find-and-replace gremlin."
      size="lg"
      onClose={onClose}
      footer={
        <>
          {selected && (
            <Button
              variant="danger"
              onClick={() => void run(() => client.deleteDictionaryEntry(selected.id))}
              disabled={disabled || busy}
            >
              Delete
            </Button>
          )}
          {selected ? (
            <Button
              variant="primary"
              onClick={() => void run(() => client.updateDictionaryEntry(selected.id, draft()))}
              disabled={disabled || busy}
            >
              Save
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void run(() => client.createDictionaryEntry(draft()))}
              disabled={disabled || busy}
            >
              Add term
            </Button>
          )}
        </>
      }
    >
      <div className="grid h-full min-h-0 overflow-hidden grid-cols-[17rem_minmax(0,1fr)] max-[820px]:grid-cols-1 max-[820px]:grid-rows-[minmax(0,14rem)_minmax(0,1fr)]">
        <aside
          className={`min-h-0 overscroll-contain overflow-y-auto border-r border-white/6 p-4 max-[820px]:border-r-0 max-[820px]:border-b ${hiddenScrollbarClass}`}
        >
          <Button
            className="mb-3 w-full"
            onClick={() => {
              setSelectedId(null);
              setTerm('');
              setHint('');
              setEnabled(true);
            }}
          >
            + Add term
          </Button>
          <div className="grid gap-2">
            {entries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`rounded-2xl border px-3 py-3 text-left transition-colors duration-200 ${selectedId === entry.id ? 'border-accent-cyan/45 bg-accent-cyan/10' : 'border-white/6 bg-white/3 hover:bg-white/6'}`}
                onClick={() => setSelectedId(entry.id)}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${entry.enabled ? 'bg-accent-green' : 'bg-text-tertiary'}`}
                  />
                  <span className="min-w-0 truncate text-sm font-semibold text-text-primary">
                    {entry.term}
                  </span>
                </div>
                <span className="mt-1 block overflow-hidden text-xs leading-snug text-text-tertiary [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                  {entry.hint || 'No hint yet'}
                </span>
              </button>
            ))}
            {entries.length === 0 && (
              <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-text-tertiary">
                No words taught yet. Suspiciously clean vocabulary.
              </p>
            )}
          </div>
        </aside>
        <div className={`min-h-0 overscroll-contain overflow-y-auto p-6 ${hiddenScrollbarClass}`}>
          <div className="grid gap-4">
            <label className="grid gap-1.5 text-sm font-semibold text-text-secondary">
              Term
              <input
                className="rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm text-text-primary outline-hidden focus:border-accent-cyan/70"
                value={term}
                disabled={disabled || busy}
                onChange={(event) => setTerm(event.currentTarget.value)}
                placeholder="Toph"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-text-secondary">
              Hint optional
              <AutoGrowTextarea
                className="min-h-32 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-sm leading-relaxed text-text-primary outline-hidden focus:border-accent-cyan/70"
                value={hint}
                disabled={disabled || busy}
                onChange={(event) => setHint(event.currentTarget.value)}
                placeholder="Proper noun. The app I am building. Sounds like toff."
              />
            </label>
            <div className="rounded-2xl border border-white/6 bg-white/3 p-4 text-sm text-text-secondary">
              <div className="mb-2 font-semibold text-text-primary">Hint examples</div>
              <div className="grid gap-1 text-xs leading-relaxed text-text-tertiary">
                <span>- Sounds like "toff"</span>
                <span>- Proper noun: the app I am building</span>
                <span>- If transcript says "whisper flow", prefer "Wispr Flow"</span>
                <span>- Preserve capitalization as "JWT"</span>
              </div>
            </div>
            <SettingsSwitch
              checked={enabled}
              disabled={disabled || busy}
              label="Dictionary entry enabled"
              onCheckedChange={setEnabled}
            />
            {error && (
              <div className="rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

export function PolishSection({
  enabled,
  activeRulePresetId,
  rulePresets,
  dictionary,
  disabled,
  client,
  onEnabledChange,
}: {
  enabled: boolean;
  activeRulePresetId: string | null;
  rulePresets: PolishRulePresetSummary[];
  dictionary: DictionaryEntrySummary[];
  disabled: boolean;
  client: DesktopApi;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dictionaryOpen, setDictionaryOpen] = useState(false);
  const activeRule = rulePresets.find((preset) => preset.id === activeRulePresetId);
  const enabledDictionaryCount = dictionary.filter((entry) => entry.enabled).length;

  return (
    <>
      <SettingsSection
        eyebrow="Writing & Dictionary"
        description="Control how Toph rewrites your dictation and teach it the words it should know."
      >
        <SettingsRow
          label="Polish Dictation"
          description="When disabled, Toph pastes the raw assembled transcript."
          icon={
            <SettingsIcon tone="green">
              <svg
                width="17"
                height="17"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 10h12M10 4v12" />
                <circle cx="10" cy="10" r="7" />
              </svg>
            </SettingsIcon>
          }
        >
          <SettingsSwitch
            checked={enabled}
            disabled={disabled}
            label="Polish Dictation"
            onCheckedChange={onEnabledChange}
          />
        </SettingsRow>
        <SettingsRow
          label="Rules"
          description={activeRule ? activeRule.title : 'Choose a preset to finish setup.'}
        >
          <Button onClick={() => setRulesOpen(true)} disabled={disabled}>
            Manage
          </Button>
        </SettingsRow>
        <SettingsRow
          label="Dictionary"
          description={`${dictionary.length} terms, ${enabledDictionaryCount} active`}
        >
          <Button onClick={() => setDictionaryOpen(true)} disabled={disabled}>
            Manage
          </Button>
        </SettingsRow>
      </SettingsSection>

      {rulesOpen && (
        <RulesModal
          rulePresets={rulePresets}
          activeRulePresetId={activeRulePresetId}
          disabled={disabled}
          client={client}
          onClose={() => setRulesOpen(false)}
        />
      )}
      {dictionaryOpen && (
        <DictionaryModal
          entries={dictionary}
          disabled={disabled}
          client={client}
          onClose={() => setDictionaryOpen(false)}
        />
      )}
    </>
  );
}
