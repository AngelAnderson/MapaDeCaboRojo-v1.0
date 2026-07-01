import React from 'react';

export const Spinner: React.FC<{ size?: number; className?: string; label?: string }> = ({
  size = 20, className = '', label,
}) => (
  <span role="status" aria-label={label || 'Cargando'} className={`inline-flex items-center gap-2 ${className}`}>
    <span
      className="rounded-full border-2 border-current/25 border-t-current animate-spin"
      style={{ width: size, height: size }}
    />
    {label && <span className="text-sm text-ink-soft">{label}</span>}
  </span>
);

export default Spinner;
