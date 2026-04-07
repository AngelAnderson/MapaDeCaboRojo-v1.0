import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAction: (action: string) => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange, onAction }) => {
  const { t } = useLanguage();

  const navItems = [
    { id: 'map',     label: t('nav_map'),  icon: 'map',      isTab: true  },
    { id: 'explore', label: 'Explorar',    icon: 'compass',  isTab: true  },
    { id: 'concierge', label: 'El Veci',   icon: 'comments', isTab: false },
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] w-[84%] max-w-xs" aria-label="Main Navigation">
      {/* Floating Glass Bubble */}
      <div className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] rounded-[35px] px-3 py-3 flex justify-evenly items-center ring-1 ring-white/40 dark:ring-white/5 transition-colors duration-500">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isConcierge = item.id === 'concierge';

          return (
            <button
              key={item.id}
              onClick={() => item.isTab ? onTabChange(item.id) : onAction('help')}
              className="flex flex-col items-center justify-center gap-1 w-16 transition-all active:scale-90 group relative"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300
                  ${isConcierge
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 hover:bg-emerald-600'
                    : isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/30 dark:shadow-white/20 scale-110'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'
                  }`}
              >
                <i className={`fa-solid fa-${item.icon} ${isActive || isConcierge ? 'text-[17px]' : 'text-[19px]'}`}></i>
                {isConcierge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white dark:border-slate-800 shadow-sm animate-pulse-dot"></span>
                )}
              </div>
              {isActive && !isConcierge && (
                <span className="absolute -bottom-8 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-bold px-2 py-0.5 rounded-md animate-fade-in shadow-sm pointer-events-none">
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
