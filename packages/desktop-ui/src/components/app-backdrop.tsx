type AppBackdropVariant = 'home' | 'settings' | 'onboarding';

const backdropClassByVariant: Record<AppBackdropVariant, string> = {
  home: 'bg-[linear-gradient(140deg,rgba(138,173,244,0.06),transparent_38%),linear-gradient(330deg,rgba(198,160,246,0.06),transparent_32%),linear-gradient(210deg,rgba(166,218,149,0.04),transparent_40%)]',
  settings:
    'bg-[linear-gradient(140deg,rgba(138,173,244,0.08),transparent_40%),linear-gradient(330deg,rgba(198,160,246,0.08),transparent_35%),linear-gradient(180deg,rgba(166,218,149,0.05),transparent_52%)]',
  onboarding:
    'bg-[linear-gradient(128deg,rgba(145,215,227,0.1),transparent_34%),linear-gradient(305deg,rgba(198,160,246,0.09),transparent_36%),linear-gradient(210deg,rgba(245,169,127,0.06),transparent_44%)]',
};

export function AppBackdrop({
  variant,
  fixed = false,
}: {
  variant: AppBackdropVariant;
  fixed?: boolean;
}) {
  return (
    <div
      className={`pointer-events-none ${fixed ? 'fixed inset-0' : 'absolute -inset-[10%]'} ${backdropClassByVariant[variant]}`}
      aria-hidden="true"
    />
  );
}
