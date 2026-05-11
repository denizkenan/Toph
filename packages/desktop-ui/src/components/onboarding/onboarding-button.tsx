import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const buttonBaseClass =
  'inline-flex cursor-pointer items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition-[transform,border-color,background-color,color,opacity] duration-200 ease-out hover:-translate-y-px disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0';

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'border-accent-blue bg-accent-blue text-[#11131f] hover:border-accent-blue/80 hover:bg-accent-blue/90',
  secondary: 'border-white/8 bg-white/5 text-text-primary hover:bg-white/8',
  ghost: 'border-transparent bg-transparent px-0 py-0 text-text-tertiary hover:text-text-secondary hover:translate-y-0',
};

export function OnboardingButton({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} className={`${buttonBaseClass} ${buttonVariantClass[variant]} ${className}`} />;
}
