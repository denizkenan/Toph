import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonBaseClass =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition-[transform,border-color,background-color,color,opacity] duration-200 ease-out hover:-translate-y-px active:scale-[0.97] disabled:cursor-default disabled:opacity-55 disabled:hover:translate-y-0 disabled:active:scale-100';

const buttonVariantClass: Record<ButtonVariant, string> = {
  primary: 'border-accent-blue bg-accent-blue text-[#11131f] hover:border-accent-blue/80 hover:bg-accent-blue/90',
  secondary: 'border-white/8 bg-white/5 text-text-primary hover:bg-white/8',
  danger: 'border-accent-red/20 bg-accent-red/10 text-accent-red hover:bg-accent-red/18',
  ghost: 'border-transparent bg-transparent px-0 py-0 text-text-tertiary hover:translate-y-0 hover:text-text-secondary',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button {...props} type={type} className={`${buttonBaseClass} ${buttonVariantClass[variant]} ${className}`} />;
}
