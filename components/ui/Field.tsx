import React from 'react';

const inputBase =
  'w-full rounded-lg bg-paper border border-line text-ink placeholder:text-ink-muted ' +
  'px-3.5 h-11 text-base transition-colors ' +
  'focus:border-brand-500 focus:ring-0 outline-none ' +
  'disabled:opacity-60';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children?: React.ReactNode;
  htmlFor?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, required, children, htmlFor }) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-ink-soft">
        {label}{required && <span className="text-coral-500 ml-0.5">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <p className="text-xs text-coral-600 dark:text-coral-400">{error}</p>
    ) : hint ? (
      <p className="text-xs text-ink-muted">{hint}</p>
    ) : null}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input ref={ref} className={`${inputBase} ${className}`} {...rest} />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea ref={ref} className={`${inputBase} h-auto py-2.5 leading-relaxed resize-y ${className}`} {...rest} />
  )
);
Textarea.displayName = 'Textarea';

export default Field;
