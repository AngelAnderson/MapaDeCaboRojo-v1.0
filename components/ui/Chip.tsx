import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  leftIcon?: React.ReactNode;
  size?: 'sm' | 'md';
  tone?: 'neutral' | 'brand';
}

/** Filter/category pill with a clear active state. */
export const Chip: React.FC<ChipProps> = ({
  active = false, leftIcon, size = 'md', tone = 'neutral', className = '', children, ...rest
}) => {
  const sizes = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-9 px-3.5 text-sm';
  const state = active
    ? (tone === 'brand'
        ? 'bg-brand-500 text-white border-brand-500 shadow-e1'
        : 'bg-ink text-canvas border-ink shadow-e1')
    : 'bg-paper text-ink-soft border-line hover:border-line-strong hover:text-ink';
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`tap chip ${sizes} border font-semibold ${state} ${className}`}
      {...rest}
    >
      {leftIcon}
      <span className="truncate">{children}</span>
    </button>
  );
};

export default Chip;
