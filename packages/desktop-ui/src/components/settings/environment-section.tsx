import { SettingsSection } from './settings-controls';

export function EnvironmentSection({
  currentDesktop,
  sessionType,
  platform,
  providerReady,
  polishEnabled,
  polishPromptId,
  permissionsReady,
  pasteHelper,
  pasteDetail,
}: {
  currentDesktop: string;
  sessionType: string;
  platform: NodeJS.Platform;
  providerReady: boolean;
  polishEnabled: boolean;
  polishPromptId: string;
  permissionsReady: boolean;
  pasteHelper: string | null;
  pasteDetail: string;
}) {
  const rows = [
    ['Desktop', currentDesktop || '—'],
    ['Session', sessionType || '—'],
    ['Platform', platform],
    ['Provider', providerReady ? 'Ready' : 'Needs setup'],
    ['Polish', polishEnabled ? polishPromptId : 'Disabled'],
    ['Permissions', permissionsReady ? 'Ready' : 'Needs setup'],
    ['Paste support', pasteHelper ?? 'None'],
  ];

  return (
    <SettingsSection eyebrow="Runtime" description="Read-only information about your current session." footer={pasteDetail || undefined}>
      <dl>
        {rows.map(([label, value], index) => (
          <div key={label} className={`flex min-h-11 items-center justify-between gap-4 px-4 py-2.5 ${index === rows.length - 1 ? '' : 'border-b border-white/5'}`}>
            <dt className="text-sm text-text-tertiary">{label}</dt>
            <dd className="m-0 text-sm font-semibold text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </SettingsSection>
  );
}
