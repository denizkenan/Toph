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
    <section className="panel-surface mb-5 rounded-3xl p-6">
      <span className="mb-2 inline-flex text-xs font-bold tracking-[0.14em] text-accent-cyan uppercase">
        Runtime
      </span>
      <h2 className="m-0 mb-4 font-display text-xl tracking-[-0.03em]">Environment</h2>

      <dl className="grid gap-3">
        {rows.map(([label, value], index) => (
          <div key={label} className={`flex justify-between gap-4 ${index === rows.length - 1 ? '' : 'border-b border-white/6 pb-3'}`}>
            <dt className="text-text-tertiary">{label}</dt>
            <dd className="m-0 text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      {pasteDetail && (
        <p className="mt-4 mb-0 text-sm text-text-secondary">{pasteDetail}</p>
      )}
    </section>
  );
}
