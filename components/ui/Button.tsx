import React from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

const base =
  'tap relative inline-flex items-center justify-center gap-2 font-semibold ' +
  'rounded-pill select-none disabled:opacity-50 disabled:pointer-events-none ' +
  'transition-colors whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-e2',
  secondary:
    'bg-paper-2 text-ink hover:bg-line active:bg-line-strong border border-line',
  ghost:
    'bg-transparent text-ink hover:bg-paper-2 active:bg-line',
  outline:
    'bg-transparent text-brand-700 dark:text-brand-400 border border-brand-500/50 hover:bg-brand-50 dark:hover:bg-brand-500/10',
  danger:
    'bg-coral-500 text-white hover:bg-coral-600 active:bg-coral-700 shadow-e2',
  gold:
    'bg-gradient-to-br from-gold-300 to-gold-500 text-gold-950 hover:from-gold-400 hover:to-gold-600 shadow-e2',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-base',
  lg: 'h-12 px-6 text-lg',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, className = '', children, disabled, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        {...rest}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
          </span>
        )}
        <span className={`inline-flex items-center gap-2 ${loading ? 'opacity-0' : ''}`}>
          {leftIcon}
          {children}
          {rightIcon}
        </span>
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
