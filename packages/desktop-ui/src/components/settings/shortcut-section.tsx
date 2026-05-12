import { useEffect, useRef, useState } from 'react';

import {
  formatShortcutChordKeys,
  normalizeDomShortcutKey,
  normalizeDomShortcutModifier,
  normalizeShortcutModifiers,
  validateShortcutCandidate,
  type ShortcutCandidate,
  type ShortcutChord,
} from '@toph/desktop-contracts';

import { Button } from '../button';
import { ModalShell } from '../modal';
import { SettingsRow, SettingsSection, StatusBadge } from './settings-controls';

function candidateFromChord(chord: ShortcutChord): ShortcutCandidate {
  return {
    modifiers: chord.modifiers,
    keys: [chord.key],
  };
}

function shortcutCandidateLabels(
  candidate: ShortcutCandidate,
  platform: NodeJS.Platform,
): string[] {
  return [
    ...normalizeShortcutModifiers(candidate.modifiers).map((modifier) => {
      if (platform === 'darwin') {
        if (modifier === 'command') return '⌘';
        if (modifier === 'control') return '⌃';
        if (modifier === 'shift') return '⇧';
        return '⌥';
      }
      if (modifier === 'command') return 'Super';
      if (modifier === 'control') return 'Ctrl';
      if (modifier === 'shift') return 'Shift';
      return 'Alt';
    }),
    ...candidate.keys,
  ];
}

function ShortcutKeyChips({ labels, large = false }: { labels: string[]; large?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {labels.map((label) => (
        <kbd
          key={label}
          className={`${large ? 'min-w-11 px-3 py-2 text-base' : 'min-w-8 px-2 py-1 text-xs'} inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/7 font-display font-semibold tracking-[-0.01em] text-text-primary shadow-[inset_0_-1px_0_rgba(255,255,255,0.06)]`}
        >
          {label}
        </kbd>
      ))}
    </span>
  );
}

function ShortcutRecorderModal({
  currentShortcut,
  platform,
  onSuspend,
  onResume,
  onCancel,
  onRegister,
}: {
  currentShortcut: ShortcutChord;
  platform: NodeJS.Platform;
  onSuspend: () => Promise<void>;
  onResume: () => Promise<void>;
  onCancel: () => void;
  onRegister: (chord: ShortcutChord) => Promise<void>;
}) {
  const [candidate, setCandidate] = useState<ShortcutCandidate>(() =>
    candidateFromChord(currentShortcut),
  );
  const [heldKeys, setHeldKeys] = useState<Set<string>>(() => new Set());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const candidateRef = useRef(candidate);
  const heldKeysRef = useRef(heldKeys);
  const registeredRef = useRef(false);

  const validation = validateShortcutCandidate(candidate);
  const labels = shortcutCandidateLabels(candidate, platform);
  const registerDisabled =
    submitting || heldKeys.size > 0 || !validation.valid || validationErrors.length > 0;

  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);

  useEffect(() => {
    heldKeysRef.current = heldKeys;
  }, [heldKeys]);

  useEffect(() => {
    return () => {
      if (!registeredRef.current) {
        void onResume();
      }
    };
  }, [onResume]);

  useEffect(() => {
    const resumeAndClose = () => {
      if (registeredRef.current) {
        return;
      }

      registeredRef.current = true;
      void onResume();
      onCancel();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        resumeAndClose();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', resumeAndClose);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', resumeAndClose);
    };
  }, [onCancel, onResume]);

  useEffect(() => {
    const addUnique = <T,>(values: T[], value: T) =>
      values.includes(value) ? values : [...values, value];

    const finishSession = () => {
      const emptyHeldKeys = new Set<string>();
      heldKeysRef.current = emptyHeldKeys;
      setHeldKeys(emptyHeldKeys);

      const result = validateShortcutCandidate(candidateRef.current);
      setValidationErrors(result.valid ? [] : result.errors);
    };

    const hasActiveModifier = (event: KeyboardEvent) =>
      event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
    const isTabNavigation = (event: KeyboardEvent) =>
      event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey;
    const isFocusedModalControl = (event: KeyboardEvent) =>
      event.target instanceof HTMLElement &&
      !!event.target.closest('a[href], button, input, select, textarea, [role="button"]');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFocusedModalControl(event)) {
        return;
      }

      if (isTabNavigation(event)) {
        return;
      }

      if (event.repeat) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const modifier = normalizeDomShortcutModifier(event.key, event.code, platform);
      const key = modifier ? null : normalizeDomShortcutKey(event.key, event.code);
      if (!modifier && !key) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const token = modifier ? `modifier:${modifier}` : `key:${key}`;
      const isNewSession = heldKeysRef.current.size === 0;
      const nextHeldKeys = new Set(heldKeysRef.current);
      nextHeldKeys.add(token);
      heldKeysRef.current = nextHeldKeys;
      setHeldKeys(nextHeldKeys);
      setRegistrationError(null);
      setValidationErrors([]);
      setCandidate((current) => {
        const base = isNewSession ? { modifiers: [], keys: [] } : current;
        const next = modifier
          ? { ...base, modifiers: addUnique(base.modifiers, modifier) }
          : { ...base, keys: addUnique(base.keys, key as string) };
        candidateRef.current = next;
        return next;
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isFocusedModalControl(event)) {
        return;
      }

      if (isTabNavigation(event)) {
        return;
      }

      const modifier = normalizeDomShortcutModifier(event.key, event.code, platform);
      const key = modifier ? null : normalizeDomShortcutKey(event.key, event.code);
      if (!modifier && !key) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const token = modifier ? `modifier:${modifier}` : `key:${key}`;
      const nextHeldKeys = new Set(heldKeysRef.current);
      nextHeldKeys.delete(token);

      if (nextHeldKeys.size === 0 || (modifier && !hasActiveModifier(event))) {
        finishSession();
        return;
      }

      heldKeysRef.current = nextHeldKeys;
      setHeldKeys(nextHeldKeys);
    };

    const handleBlur = () => {
      if (heldKeysRef.current.size > 0) {
        finishSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [platform]);

  const registerShortcut = async () => {
    const result = validateShortcutCandidate(candidateRef.current);
    if (!result.valid) {
      setValidationErrors(result.errors);
      return;
    }

    setSubmitting(true);
    setRegistrationError(null);
    try {
      await onRegister(result.chord);
      registeredRef.current = true;
    } catch (error) {
      setCandidate(candidateFromChord(currentShortcut));
      setValidationErrors([]);
      setRegistrationError(
        error instanceof Error
          ? error.message
          : 'Unable to register this shortcut. Your previous shortcut is still active.',
      );
      await onSuspend();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      eyebrow="Shortcut"
      title="Set shortcut"
      titleId="shortcut-recorder-title"
      description="Press and release the keys you want to use for dictation. Escape gets captured too; no trapdoors here."
      onClose={onCancel}
      closeDisabled={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Discard
          </Button>
          <Button
            variant="primary"
            onClick={() => void registerShortcut()}
            disabled={registerDisabled}
          >
            {submitting ? 'Registering...' : 'Register'}
          </Button>
        </>
      }
    >
      <div className="px-6 py-5">
        <div className="rounded-2xl border border-white/8 bg-canvas/60 p-4">
          <div className="mb-3 text-xs font-semibold tracking-[0.08em] text-text-tertiary uppercase">
            {heldKeys.size > 0 ? 'Listening' : 'Candidate'}
          </div>
          {labels.length > 0 ? (
            <ShortcutKeyChips labels={labels} large />
          ) : (
            <span className="text-sm text-text-tertiary">Press your shortcut keys...</span>
          )}
        </div>

        {(validationErrors.length > 0 || registrationError) && (
          <div className="mt-3 rounded-xl border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-sm leading-relaxed text-accent-red">
            {registrationError ?? validationErrors.join(' ')}
          </div>
        )}

        <p className="mt-3 mb-0 text-xs leading-relaxed text-text-tertiary">
          Use one main key. Regular keys need a modifier; function keys like F15 can fly solo.
        </p>
      </div>
    </ModalShell>
  );
}

export function ShortcutSection({
  shortcut,
  platform,
  registered,
  backend,
  detail,
  installed,
  installable,
  onRegister,
  onSuspend,
  onResume,
}: {
  shortcut: ShortcutChord;
  platform: NodeJS.Platform;
  registered: boolean;
  backend: string;
  detail: string;
  installed: boolean;
  installable: boolean;
  onRegister: (chord: ShortcutChord) => Promise<void>;
  onSuspend: () => Promise<void>;
  onResume: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [opening, setOpening] = useState(false);
  const shortcutLabels = formatShortcutChordKeys(shortcut, platform);

  const openRecorder = async () => {
    setOpening(true);
    try {
      await onSuspend();
      setOpen(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <SettingsSection
        eyebrow="Shortcut"
        description="Configure the keyboard shortcut that triggers dictation."
        footer={detail}
      >
        <SettingsRow label="Registration">
          <StatusBadge
            active={registered}
            activeLabel="Active"
            inactiveLabel="Needs attention"
            inactiveTone="red"
          />
        </SettingsRow>

        <SettingsRow label="Shortcut">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/8 bg-white/5 px-3 py-2 transition-[transform,background-color,opacity] duration-200 ease-out hover:-translate-y-px hover:bg-white/8 disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0"
            onClick={() => void openRecorder()}
            disabled={!installable || opening}
          >
            <ShortcutKeyChips labels={shortcutLabels} />
            <span className="text-xs font-semibold text-accent-blue">
              {opening ? 'Opening...' : 'Change'}
            </span>
          </button>
        </SettingsRow>

        <SettingsRow label="Backend">
          <span className="text-sm font-semibold text-text-secondary">{backend}</span>
        </SettingsRow>

        <SettingsRow label="Installed">
          <StatusBadge
            active={installed}
            activeLabel="Installed"
            inactiveLabel="Not installed"
            inactiveTone="amber"
          />
        </SettingsRow>
      </SettingsSection>

      {open && (
        <ShortcutRecorderModal
          currentShortcut={shortcut}
          platform={platform}
          onSuspend={onSuspend}
          onResume={onResume}
          onCancel={() => setOpen(false)}
          onRegister={async (chord) => {
            await onRegister(chord);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
