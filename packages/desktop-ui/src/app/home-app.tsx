import { useEffect, useState } from 'react';

import type { AppState, ConversionRecord, DesktopApi } from '@toph/desktop-contracts';

import { AppBackdrop } from '../components/app-backdrop';
import { DictationCard } from '../components/dictation-card';
import { WindowDragRegion } from '../components/window-drag-region';
import { useDesktopState } from '../hooks/use-desktop-state';
import { OnboardingScreen } from './onboarding/onboarding-screen';
import { SettingsPage } from './settings-page';

type ActiveView = 'home' | 'settings';

function countWordsInConversions(conversions: ConversionRecord[]): number {
  let total = 0;
  for (const c of conversions) {
    const trimmed = c.text.trim();
    if (trimmed.length > 0) {
      total += trimmed.split(/\s+/).length;
    }
  }
  return total;
}

function countTodayConversions(conversions: ConversionRecord[]): number {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const threshold = todayStart.getTime();

  let count = 0;
  for (const c of conversions) {
    if (c.createdAt >= threshold) {
      count++;
    }
  }
  return count;
}

function formatTimeSaved(totalWords: number): string {
  const typingWpm = 40;
  const minutesSaved = totalWords / typingWpm;

  if (minutesSaved < 1) {
    return '< 1m';
  }
  if (minutesSaved < 60) {
    return `~${Math.round(minutesSaved)}m`;
  }

  const hours = Math.floor(minutesSaved / 60);
  const mins = Math.round(minutesSaved % 60);
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}

function formatWordCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

function deriveSystemStatus(state: AppState): { label: string; tone: string } {
  if (!state.providers.ready) {
    return { label: 'Provider needed', tone: 'text-accent-amber' };
  }
  if (!state.permissions.ready) {
    return { label: 'Permissions needed', tone: 'text-accent-amber' };
  }
  if (!hasActiveWritingPreset(state)) {
    return { label: 'Writing setup needed', tone: 'text-accent-amber' };
  }
  if (!state.shortcut.registered) {
    return { label: 'Shortcut not configured', tone: 'text-accent-amber' };
  }
  if (state.pasteSupport.helper === null) {
    return { label: 'Paste helper unavailable', tone: 'text-accent-amber' };
  }
  return { label: 'All systems go', tone: 'text-accent-green' };
}

function hasActiveWritingPreset(state: AppState): boolean {
  // Onboarding requires an explicit writing style choice before first use, even
  // when polish is disabled later, so the app never silently chooses a preset.
  return !!state.settings.polish.rulePresetId && state.polish.rulePresets.some((preset) => preset.id === state.settings.polish.rulePresetId);
}

function HomeScreen({ state, onNavigateSettings }: { state: AppState; onNavigateSettings: () => void }) {
  const totalWords = countWordsInConversions(state.recentConversions);
  const todayCount = countTodayConversions(state.recentConversions);
  const timeSaved = formatTimeSaved(totalWords);
  const systemStatus = deriveSystemStatus(state);

  return (
    <main className="relative min-h-screen overflow-hidden px-10 pt-12 pb-10 max-[980px]:px-6 max-[980px]:pb-6">
      {state.environment.platform === 'darwin' && (
        <WindowDragRegion />
      )}
      <AppBackdrop variant="home" />

      <section className="relative mx-auto max-w-[720px]">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="m-0 font-display text-[2.4rem] tracking-[-0.04em]">Toph</h1>
            <p className="mt-1.5 mb-0 text-text-secondary">
              Press{' '}
              <kbd className="rounded-lg border border-white/12 bg-white/5 px-2 py-0.5 text-[0.85rem] text-text-primary">
                {state.shortcut.label}
              </kbd>{' '}
              to dictate
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/5 px-3.5 py-2 text-sm ${systemStatus.tone}`}>
              <span className={`size-2 rounded-full ${systemStatus.tone === 'text-accent-green' ? 'bg-accent-green' : 'bg-accent-amber'}`} />
              {systemStatus.label}
            </span>

            <button
              type="button"
              className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-white/4 text-text-tertiary transition-all duration-200 ease-out hover:-translate-y-px hover:bg-white/8 hover:text-text-primary"
              onClick={onNavigateSettings}
              aria-label="Settings"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" />
                <path d="M14.55 11.25a1.24 1.24 0 0 0 .25 1.37l.05.04a1.5 1.5 0 1 1-2.12 2.12l-.05-.04a1.24 1.24 0 0 0-1.37-.25 1.24 1.24 0 0 0-.75 1.14v.12a1.5 1.5 0 1 1-3 0v-.07a1.24 1.24 0 0 0-.82-1.14 1.24 1.24 0 0 0-1.37.25l-.04.05a1.5 1.5 0 1 1-2.12-2.12l.04-.05a1.24 1.24 0 0 0 .25-1.37 1.24 1.24 0 0 0-1.14-.75h-.12a1.5 1.5 0 1 1 0-3h.07a1.24 1.24 0 0 0 1.14-.82 1.24 1.24 0 0 0-.25-1.37l-.05-.04A1.5 1.5 0 1 1 5.28 3.2l.05.04a1.24 1.24 0 0 0 1.37.25h.06a1.24 1.24 0 0 0 .75-1.14v-.12a1.5 1.5 0 0 1 3 0v.07a1.24 1.24 0 0 0 .75 1.14 1.24 1.24 0 0 0 1.37-.25l.04-.05a1.5 1.5 0 1 1 2.12 2.12l-.04.05a1.24 1.24 0 0 0-.25 1.37v.06a1.24 1.24 0 0 0 1.14.75h.12a1.5 1.5 0 0 1 0 3h-.07a1.24 1.24 0 0 0-1.14.75Z" />
              </svg>
            </button>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-4 gap-3 max-[640px]:grid-cols-2">
          <StatCard label="today" value={String(todayCount)} />
          <StatCard label="words" value={formatWordCount(totalWords)} />
          <StatCard label="saved" value={timeSaved} />
          <StatCard label="cost" value="—" />
        </div>

        <section>
          <h2 className="m-0 mb-4 font-display text-lg tracking-[-0.02em] text-text-secondary">
            Recent
          </h2>

          {state.recentConversions.length > 0 ? (
            <div className="flex flex-col overflow-hidden rounded-3xl border border-white/6 bg-white/3 divide-y divide-white/6">
              {state.recentConversions.map((conversion) => (
                <DictationCard key={conversion.id} conversion={conversion} />
              ))}
            </div>
          ) : (
            <div className="grid gap-1.5 rounded-2xl border border-dashed border-white/10 bg-white/2 p-6 text-center">
              <p className="m-0 font-display text-base text-text-primary">Nothing here yet.</p>
              <span className="text-sm text-text-secondary">
                Press{' '}
                <kbd className="rounded-md border border-white/10 bg-white/4 px-1.5 py-0.5 text-xs text-text-primary">
                  {state.shortcut.label}
                </kbd>{' '}
                and say something brilliant. Or mediocre. I don't judge.
              </span>
            </div>
          )}
        </section>

        <footer className="mt-8 flex items-center justify-between gap-4 text-xs text-text-tertiary">
          <span>Audio retained for last 10 items</span>
          <span>
            {state.phase === 'listening'
              ? 'Listening...'
              : state.phase === 'transcribing'
                ? 'Transcribing...'
                : state.phase === 'polishing'
                  ? 'Polishing...'
                : state.phase === 'no_speech'
                  ? 'No speech detected'
              : state.phase === 'failed'
                  ? 'Recording failed'
                : 'Ready'}
          </span>
        </footer>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 px-4 py-3 transition-colors duration-200 hover:border-white/10">
      <p className="m-0 font-display text-2xl tracking-[-0.03em] text-text-primary">
        {value}
      </p>
      <span className="text-xs font-medium tracking-wide text-text-tertiary uppercase">
        {label}
      </span>
    </div>
  );
}

export function HomeApp({ client }: { client: DesktopApi }) {
  const state = useDesktopState(client);
  const [view, setView] = useState<ActiveView>('home');
  const [setupWasRequired, setSetupWasRequired] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const setupComplete = state ? state.providers.ready && state.permissions.ready && hasActiveWritingPreset(state) : false;

  useEffect(() => {
    if (state && !setupComplete) {
      setSetupWasRequired(true);
      setSetupDismissed(false);
    }
  }, [state, setupComplete]);

  if (!state) {
    return (
      <main className="relative min-h-screen overflow-hidden px-10 pt-12 pb-10 max-[980px]:px-6 max-[980px]:pb-6">
        <AppBackdrop variant="home" />
        <section className="relative mx-auto max-w-[720px]">
          <h1 className="m-0 font-display text-[2.4rem] tracking-[-0.04em]">Toph</h1>
          <p className="mt-3 mb-0 text-text-secondary">Connecting to the desktop runtime...</p>
        </section>
      </main>
    );
  }

  const showOnboarding = !setupComplete || (setupWasRequired && !setupDismissed);

  if (showOnboarding) {
    return (
      <OnboardingScreen
        platform={state.environment.platform}
        providers={state.providers}
        permissionsReady={state.permissions.ready}
        rulePresets={state.polish.rulePresets}
        activeRulePresetId={state.settings.polish.rulePresetId}
        requirements={state.permissions.requirements}
        client={client}
        onGetStarted={() => setSetupDismissed(true)}
      />
    );
  }

  if (view === 'settings') {
    return <SettingsPage state={state} client={client} onBack={() => setView('home')} />;
  }

  return <HomeScreen state={state} onNavigateSettings={() => setView('settings')} />;
}
