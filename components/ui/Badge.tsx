import React from 'react';

type Tone = 'brand' | 'coral' | 'gold' | 'neutral' | 'success' | 'warning';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  coral: 'bg-coral-50 text-coral-700 dark:bg-coral-500/15 dark:text-coral-300',
  gold: 'bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300',
  neutral: 'bg-paper-2 text-ink-soft',
  success: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  warning: 'bg-gold-100 text-gold-800 dark:bg-gold-500/15 dark:text-gold-300',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: React.ReactNode;
  solid?: boolean;
}

/** Small status pill: verified, sponsor, open/closed, freshness. */
export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', icon, solid, className = '', children, ...rest }) => {
  const solidMap: Record<Tone, string> = {
    brand: 'bg-brand-500 text-white', coral: 'bg-coral-500 text-white',
    gold: 'bg-gold-400 text-gold-950', neutral: 'bg-ink text-canvas',
    success: 'bg-brand-500 text-white', warning: 'bg-gold-400 text-gold-950',
  };
  return (
    <span
      className={`chip px-2 py-1 text-2xs uppercase tracking-wide ${solid ? solidMap[tone] : tones[tone]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
};

export default Badge;
