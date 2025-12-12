
import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface CommandMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (actionId: string) => void;
  isDarkMode: boolean;
}

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  group: string;
  shortcut?: string;
}

const CommandMenu: React.FC<CommandMenuProps> = ({ isOpen, onClose, onSelect, isDarkMode }) => {
  const { t, language } = useLanguage();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav_map', label: t('nav_map'), icon: 'map', group: 'Navigation' },
    { id: 'nav_explore', label: t('nav_explore'), icon: 'compass', group: 'Navigation' },
    
    // Actions
    { id: 'action_search', label: t('search'), icon: 'magnifying-glass', group: 'Actions' },
    { id: 'action_add', label: t('btn_suggest'), icon: 'circle-plus', group: 'Actions' },
    { id: 'action_chat', label: t('nav_help'), icon: 'robot', group: 'Actions' },
    { id: 'action_contact', label: t('nav_contact'), icon: 'address-book', group: 'Actions' },

    // System
    { id: 'sys_theme', label: isDarkMode ? t('light_mode') : t('dark_mode'), icon: isDarkMode ? 'sun' : 'moon', group: 'System', shortcut: 'T' },
    { id: 'sys_lang', label: language === 'es' ? t('switch_to_english') : t('switch_to_spanish'), icon: 'language', group: 'System', shortcut: 'L' },
    { id: 'sys_admin', label: t('admin_login'), icon: 'lock', group: 'System' },
  ];

  const filteredCommands = commands.filter(cmd => 
    cmd.label.toLowerCase().includes(query.toLowerCase()) || 
    cmd.group.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % filteredCommands.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[activeIndex]) {
        onSelect(filteredCommands[activeIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-start justify-center pt-[20vh] px-4 animate-fade-in">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      
      <div className="w-full max-w-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-white/20 dark:border-slate-700 shadow-2xl rounded-2xl overflow-hidden transform transition-all scale-100 animate-slide-up ring-1 ring-black/5 dark:ring-white/10">
        
        {/* Search Input */}
        <div className="flex items-center border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-4">
          <i className="fa-solid fa-magnifying-glass text-slate-400 dark:text-slate-500 text-lg mr-4"></i>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-xl text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-medium"
            placeholder={t('type_a_command')}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <div className="hidden sm:flex gap-2">
            <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-1 rounded">esc</span>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              <p>{t('no_results_found')}</p>
            </div>
          ) : (
            <>
              {/* Grouping logic could be added here, but flat list is cleaner for Spotlight feel */}
              {filteredCommands.map((cmd, index) => (
                <button
                  key={cmd.id}
                  onClick={() => { onSelect(cmd.id); onClose(); }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${
                    index === activeIndex 
                      ? 'bg-teal-600 text-white shadow-md shadow-teal-900/20' 
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/50'
                  }`}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      index === activeIndex 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      <i className={`fa-solid fa-${cmd.icon}`}></i>
                    </div>
                    <div className="text-left">
                      <span className={`block font-bold text-sm ${index === activeIndex ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                        {cmd.label}
                      </span>
                      <span className={`block text-[10px] uppercase tracking-wider ${index === activeIndex ? 'text-teal-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {cmd.group}
                      </span>
                    </div>
                  </div>
                  
                  {cmd.shortcut && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      index === activeIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                    }`}>
                      {cmd.shortcut}
                    </span>
                  )}
                  {index === activeIndex && !cmd.shortcut && (
                     <i className="fa-solid fa-arrow-turn-down rotate-90 text-white/50 text-xs"></i>
                  )}
                </button>
              ))}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="bg-slate-50/80 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-700/50 px-4 py-2 flex justify-between items-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            <span>{t('app_version')}</span>
            <div className="flex gap-3">
                <span>{t('select')} <b className="text-slate-600 dark:text-slate-300">↵</b></span>
                <span>{t('navigate')} <b className="text-slate-600 dark:text-slate-300">↑↓</b></span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CommandMenu;