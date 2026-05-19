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
      className={`inline-flex items-center bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/60 dark:border-slate-700/50 rounded-full p-0.5 shadow-md ${className}`}
      role="tablist"
      aria-label="Vista de audiencia"
    >
      <button
        role="tab"
        aria-selected={mode === 'vecino'}
        onClick={() => onChange('vecino')}
        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${
          mode === 'vecino'
            ? 'bg-teal-600 text-white shadow-sm'
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
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
            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <i className="fa-solid fa-umbrella-beach text-[10px]" aria-hidden="true"></i>
        Turista
      </button>
    </div>
  );
};

export default AudienceToggle;
