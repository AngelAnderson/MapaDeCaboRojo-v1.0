
import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface SearchBarProps {
  value: string;
  onChange: (val: string) => void;
  onClear: () => void;
  resultCount: number;
  focusTrigger?: number; // Used to trigger focus programmatically
  onCameraClick?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange, onClear, resultCount, focusTrigger, onCameraClick }) => {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when trigger changes
  useEffect(() => {
    if (focusTrigger && focusTrigger > 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [focusTrigger]);

  return (
    <div className="relative w-full group flex gap-2">
      <div className="relative flex-1">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted transition-colors group-focus-within:text-ink-soft dark:group-focus-within:text-ink-muted">
            <i className="fa-solid fa-magnifying-glass text-sm"></i>
        </div>
        <input 
            ref={inputRef}
            type="text" 
            placeholder={t('search')} 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full pl-10 pr-14 py-3 rounded-xl bg-slate-100/80 dark:bg-slate-700/50 border border-transparent text-ink font-medium text-[15px] placeholder-slate-400 focus:bg-white dark:focus:bg-slate-700 focus:shadow-md focus:shadow-slate-200/50 dark:focus:shadow-none transition-all outline-none"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {value && (
                <button onClick={onClear} className="w-5 h-5 rounded-full bg-slate-300 dark:bg-slate-600 text-white flex items-center justify-center hover:bg-slate-400 dark:hover:bg-slate-500 transition-colors">
                    <i className="fa-solid fa-xmark text-[10px]"></i>
                </button>
            )}
        </div>
      </div>
      
      {/* Visual Search Button */}
      <button 
        onClick={onCameraClick}
        className="w-12 h-12 rounded-xl bg-slate-100/80 dark:bg-slate-700/50 flex items-center justify-center text-ink-muted dark:text-ink-muted hover:bg-brand-600 hover:text-white transition-all active:scale-95 border border-transparent"
        title="¿Qué es esto?"
      >
        <i className="fa-solid fa-camera"></i>
      </button>
    </div>
  );
};
export default SearchBar;
