import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  DesktopApi,
  PermissionRequirement,
  PermissionRequirementId,
  ProviderId,
  ProviderState,
} from '@toph/desktop-contracts';
import { AppBackdrop } from '../../components/app-backdrop';
import { Button } from '../../components/button';
import { CheckIcon } from '../../components/onboarding/check-icon';
import { isPermissionComplete } from '../../components/onboarding/onboarding-utils';
import { PermissionCard } from '../../components/onboarding/permission-card';
import { ProviderCard } from '../../components/onboarding/provider-card';
import { StepSection } from '../../components/onboarding/step-section';
import { WindowDragRegion } from '../../components/window-drag-region';

export function OnboardingScreen({
  platform,
  providers,
  permissionsReady,
  requirements,
  client,
}: {
  platform: NodeJS.Platform;
  providers: ProviderState;
  permissionsReady: boolean;
  requirements: PermissionRequirement[];
  client: DesktopApi;
}) {
  const [busyPermission, setBusyPermission] = useState<PermissionRequirementId | 'refresh' | null>(null);
  const [busyProvider, setBusyProvider] = useState<ProviderId | 'manual' | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>(
    providers.selectedProviderId ?? providers.providers[0]?.id ?? 'openai-sub',
  );
  const [manualInput, setManualInput] = useState('');
  const refreshingRef = useRef(false);
  const completeCount = requirements.filter((requirement) =>
    isPermissionComplete(requirement)
  ).length;
  const providerComplete = providers.ready;
  const permissionsComplete = permissionsReady && completeCount === requirements.length;

  const performAction = async (permissionId: PermissionRequirementId) => {
    setBusyPermission(permissionId);
    try {
      await client.performPermissionAction(permissionId);
    } finally {
      setBusyPermission(null);
    }
  };

  const connectProvider = async () => {
    setBusyProvider(selectedProviderId);
    try {
      await client.connectProvider(selectedProviderId);
    } catch {
      // Main process publishes the actionable provider error in AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const submitManualAuthorization = async () => {
    setBusyProvider('manual');
    try {
      await client.submitProviderAuthorization(selectedProviderId, manualInput);
      setManualInput('');
    } catch {
      // Main process publishes the actionable provider error in AppState.
    } finally {
      setBusyProvider(null);
    }
  };

  const refresh = useCallback(async () => {
    if (refreshingRef.current) {
      return;
    }

    refreshingRef.current = true;
    setRefreshFailed(false);
    setBusyPermission('refresh');
    try {
      const results = await Promise.allSettled([
        client.refreshPermissions(),
        client.refreshProviders(),
      ]);
      setRefreshFailed(results.some((result) => result.status === 'rejected'));
    } finally {
      setBusyPermission(null);
      refreshingRef.current = false;
    }
  }, [client]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }

      void refresh();
    };

    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);

    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [refresh]);

  return (
    <main className="relative min-h-screen overflow-hidden px-10 pt-20 pb-10 max-[980px]:px-6 max-[980px]:pt-14 max-[980px]:pb-8">
      {platform === 'darwin' && (
        <WindowDragRegion />
      )}
      <AppBackdrop variant="onboarding" />

      <section className="relative mx-auto min-h-[calc(100vh-7.5rem)] max-w-[1100px]">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.4fr] max-[980px]:gap-12">
          <header className="max-w-[390px] lg:sticky lg:top-20 max-[980px]:mx-auto max-[980px]:text-center">
            <span className="mb-6 inline-flex rounded-full border border-accent-cyan/18 bg-accent-cyan/6 px-3.5 py-1.5 font-display text-xs font-semibold tracking-[0.12em] text-accent-cyan uppercase">
              Setup
            </span>
            <h1 className="m-0 font-display text-[2.6rem] leading-[1.05] font-semibold tracking-[-0.05em] text-text-primary max-[640px]:text-[2rem]">
              Your fingers called, they want a break.
            </h1>
            <p className="mt-5 mb-0 text-base leading-relaxed text-text-secondary">
              Real-time voice transcription across all your apps. I capture your words so you can focus on breaking production, not your wrists.
            </p>
            <div className="mt-8 grid gap-3.5 text-left max-[980px]:mx-auto max-[980px]:max-w-[26rem]">
              {[
                'Bring your own subscription - no new SaaS bill padding',
                'Auto-punctuation and formatting. Your ramble, but intentional',
                "Near-instant transcription. I keep up with your voice so your brain doesn't outrun the page.",
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm text-text-secondary">
                  <span className="size-2 shrink-0 rounded-full bg-accent-cyan shadow-[0_0_12px_rgba(145,215,227,0.4)]" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </header>

          <div>
            <div>
              <StepSection
                complete={providerComplete}
                showConnector
                marker={providerComplete ? <CheckIcon size={16} /> : <span className="font-display text-sm font-semibold">1</span>}
                title="Choose a provider"
                status={providerComplete ? 'Complete' : 'Pending'}
              >
                <ProviderCard
                  providers={providers.providers}
                  selectedProviderId={selectedProviderId}
                  busy={busyProvider !== null}
                  manualInput={manualInput}
                  onSelectProvider={setSelectedProviderId}
                  onManualInputChange={setManualInput}
                  onConnect={() => void connectProvider()}
                  onSubmitManual={() => void submitManualAuthorization()}
                />
              </StepSection>

              <StepSection
                complete={permissionsComplete}
                marker={permissionsComplete ? <CheckIcon size={16} /> : <span className="font-display text-sm font-semibold">2</span>}
                title="Grant permissions"
                status={permissionsComplete ? 'Complete' : 'Pending'}
              >
                <div className="rounded-[1.375rem] border border-white/6 bg-white/2 px-5 py-4 transition-[transform,border-color,background-color] duration-300 ease-out hover:-translate-y-px hover:border-white/10 hover:bg-white/3">
                  {!permissionsReady && requirements.length === 0 ? (
                    <div className="px-1 py-2">
                      <h3 className="m-0 font-display text-base tracking-[-0.02em] text-text-primary">Inspecting permissions...</h3>
                      <p className="mt-1 mb-0 text-sm text-text-secondary">
                        Rehydrating the macOS permission cache. Classic distributed system: you and System Settings.
                      </p>
                    </div>
                  ) : requirements.length === 0 ? (
                    <div className="px-1 py-2">
                      <h3 className="m-0 font-display text-base tracking-[-0.02em] text-text-primary">No permissions needed</h3>
                      <p className="mt-1 mb-0 text-sm text-text-secondary">
                        Your system already handed over the tiny keys. Suspiciously cooperative.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {requirements.map((requirement) => (
                        <PermissionCard
                          key={requirement.id}
                          requirement={requirement}
                          busy={busyPermission === requirement.id}
                          disabled={!providers.ready}
                          onAction={performAction}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </StepSection>

              <p className="mt-0 mb-0 pl-16 text-sm text-text-tertiary max-[640px]:pl-12">
                Changed something in System Settings?{' '}
                <Button
                  variant="ghost"
                  onClick={() => void refresh()}
                  disabled={busyPermission !== null || busyProvider !== null}
                >
                  {busyPermission === 'refresh' ? 'Checking...' : 'Check again'}
                </Button>
                {refreshFailed && (
                  <span className="block pt-1 text-accent-amber">
                    Refresh could not verify everything. Very rude of the runtime.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
