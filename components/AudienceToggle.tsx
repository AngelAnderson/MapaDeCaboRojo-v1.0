import React from 'react';
import { AudienceMode } from '../utils/audience';

interface Props {
  mode: AudienceMode;
  onChange: (mode: AudienceMode) => void;
  className?: string;
}

const AudienceToggle: React.FC<Props> = ({ mode, onChange, className = '' }) => {
  return (
    <div
      className={`inline-flex items-center bg-paper/80 backdrop-blur-md border border-line rounded-full p-0.5 shadow-md ${className}`}
      role="tablist"
      aria-label="Vista de audiencia"
    >
      <button
        role="tab"
        aria-selected={mode === 'vecino'}
        onClick={() => onChange('vecino')}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
          mode === 'vecino'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-ink-muted hover:text-ink dark:hover:text-ink'
        }`}
      >
        <i className="fa-solid fa-house text-[10px]" aria-hidden="true"></i>
        Vecino
      </button>
      <button
        role="tab"
        aria-selected={mode === 'turista'}
        onClick={() => onChange('turista')}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
          mode === 'turista'
            ? 'bg-amber-500 text-white shadow-sm'
            : 'text-ink-muted hover:text-ink dark:hover:text-ink'
        }`}
      >
        <i className="fa-solid fa-umbrella-beach text-[10px]" aria-hidden="true"></i>
        Turista
      </button>
    </div>
  );
};

export default AudienceToggle;
