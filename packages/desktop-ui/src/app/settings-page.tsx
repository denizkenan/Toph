import { useState } from "react";

import {
  resolveShortcutPresetForPlatform,
  SHORTCUT_PRESETS,
  type AppState,
  type DesktopApi,
  type ProviderId,
  type ShortcutPresetId,
} from "@toph/desktop-contracts";

import { EnvironmentSection } from "../components/settings/environment-section";
import { PolishSection } from "../components/settings/polish-section";
import { ProviderSection } from "../components/settings/provider-section";
import { RoutingSection } from "../components/settings/routing-section";
import { ShortcutSection } from "../components/settings/shortcut-section";
import { Button } from "../components/button";
import { AppBackdrop } from "../components/app-backdrop";
import { WindowDragRegion } from "../components/window-drag-region";

export function SettingsPage({
  state,
  client,
  onBack,
}: {
  state: AppState;
  client: DesktopApi;
  onBack: () => void;
}) {
  const [presetOverride, setPresetOverride] = useState<ShortcutPresetId | null>(
    null,
  );
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [busyPolish, setBusyPolish] = useState(false);
  const [busySettings, setBusySettings] = useState(false);
  const selectedPresetId = presetOverride ?? state.shortcut.presetId;
  const shortcutDirty = selectedPresetId !== state.shortcut.presetId;
  const provider = state.providers.providers[0];
  const settingsEditable = state.phase === "idle";

  const presetItems = SHORTCUT_PRESETS.map((preset) => ({
    value: preset.id,
    label: resolveShortcutPresetForPlatform(
      preset.id,
      state.environment.platform,
    ).label,
  }));
  const providerItems = state.providers.providers.map((item) => ({
    value: item.id,
    label: item.label,
  }));
  const polishPromptItems = state.polish.prompts.map((prompt) => ({
    value: prompt.id,
    label: prompt.title,
  }));

  const connectProvider = async () => {
    if (!provider) {
      return;
    }

    setBusyProvider(provider.id);
    try {
      await client.connectProvider(provider.id);
    } catch {
      // Main process publishes provider errors into AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const removeProvider = async () => {
    if (!provider) {
      return;
    }

    setBusyProvider(provider.id);
    try {
      await client.removeProvider(provider.id);
    } finally {
      setBusyProvider(null);
    }
  };

  const setPolishEnabled = async (enabled: boolean) => {
    setBusyPolish(true);
    try {
      await client.setPolishEnabled(enabled);
    } finally {
      setBusyPolish(false);
    }
  };

  const updateSetting = async (action: () => Promise<void>) => {
    setBusySettings(true);
    try {
      await action();
    } finally {
      setBusySettings(false);
    }
  };

  const setActivePolishPrompt = async (promptId: string) => {
    setBusyPolish(true);
    try {
      await client.setActivePolishPrompt(promptId);
    } finally {
      setBusyPolish(false);
    }
  };

  return (
    <main className="relative h-screen overflow-y-auto bg-canvas px-6 pt-8 pb-10 [scrollbar-width:none] max-[640px]:px-5 [&::-webkit-scrollbar]:hidden">
      {state.environment.platform === "darwin" && (
        <WindowDragRegion />
      )}
      <AppBackdrop variant="settings" fixed />

      <section className="relative mx-auto max-w-160">
        <header className="mb-5 flex items-center gap-4 pt-4 pb-5">
          <button
            type="button"
            className="inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-white/8 bg-white/5 text-text-secondary transition-colors duration-200 ease-out hover:bg-white/10 hover:text-text-primary"
            onClick={onBack}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M11 4L6 9L11 14" />
            </svg>
          </button>
          <h1 className="m-0 font-display text-[28px] font-bold tracking-[-0.03em]">
            Settings
          </h1>
        </header>

        <ProviderSection
          provider={provider}
          busy={busyProvider !== null}
          onConnect={() => void connectProvider()}
          onRemove={() => void removeProvider()}
        />

        <RoutingSection
          providerItems={providerItems}
          authProviderId={state.settings.auth.providerId}
          transcriptionProviderId={state.settings.transcription.providerId}
          transcriptionModel={state.settings.transcription.model}
          inferenceProviderId={state.settings.inference.providerId}
          inferenceModel={state.settings.inference.model}
          disabled={!settingsEditable || busySettings}
          onAuthProviderChange={(providerId: ProviderId) =>
            void updateSetting(() => client.setAuthProvider(providerId))
          }
          onTranscriptionProviderChange={(providerId: ProviderId) =>
            void updateSetting(() =>
              client.setTranscriptionProvider(providerId),
            )
          }
          onTranscriptionModelChange={(model) =>
            void updateSetting(() => client.setTranscriptionModel(model))
          }
          onInferenceProviderChange={(providerId: ProviderId) =>
            void updateSetting(() => client.setInferenceProvider(providerId))
          }
          onInferenceModelChange={(model) =>
            void updateSetting(() => client.setInferenceModel(model))
          }
        />

        <PolishSection
          enabled={state.settings.polish.enabled}
          promptId={state.settings.polish.promptId}
          promptItems={polishPromptItems}
          disabled={!settingsEditable || busyPolish}
          onEnabledChange={(enabled) => void setPolishEnabled(enabled)}
          onPromptChange={(promptId) => void setActivePolishPrompt(promptId)}
        />

        <ShortcutSection
          presetItems={presetItems}
          selectedPresetId={selectedPresetId}
          registered={state.shortcut.registered}
          backend={state.shortcut.backend}
          detail={state.shortcut.detail}
          dirty={shortcutDirty}
          installed={state.shortcut.installed}
          installable={state.shortcut.installable}
          onPresetChange={setPresetOverride}
          onApply={() => void client.installShortcut(selectedPresetId)}
        />

        <EnvironmentSection
          currentDesktop={state.environment.currentDesktop}
          sessionType={state.environment.sessionType}
          platform={state.environment.platform}
          providerReady={state.providers.ready}
          polishEnabled={state.settings.polish.enabled}
          polishPromptId={state.settings.polish.promptId}
          permissionsReady={state.permissions.ready}
          pasteHelper={state.pasteSupport.helper}
          pasteDetail={state.pasteSupport.detail}
        />

        <div className="flex justify-end border-t border-white/6 pt-5">
          <Button variant="danger" onClick={() => void client.quit()}>
            Quit Toph
          </Button>
        </div>
      </section>
    </main>
  );
}
