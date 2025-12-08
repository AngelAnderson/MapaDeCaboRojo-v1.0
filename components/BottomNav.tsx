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
    { id: 'map', label: t('nav_map'), icon: 'map' },
    { id: 'explore', label: t('nav_explore'), icon: 'compass' },
    { id: 'add', label: t('nav_add'), icon: 'circle-plus', isAction: true },
    { id: 'contact', label: t('nav_contact'), icon: 'address-book', isAction: true },
    { id: 'help', label: t('nav_help'), icon: 'comments', isAction: true }, 
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] w-[92%] max-w-sm" aria-label="Main Navigation">
        {/* Floating Glass Bubble */}
        <div className="bg-white/70 dark:bg-slate-800/80 backdrop-blur-2xl backdrop-saturate-150 border border-white/60 dark:border-white/10 shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)] rounded-[35px] px-2 py-3 flex justify-evenly items-center ring-1 ring-white/40 dark:ring-white/5 transition-colors duration-500">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => item.isAction ? onAction(item.id) : onTabChange(item.id)}
                className={`flex flex-col items-center justify-center gap-1 w-14 transition-all active:scale-90 group relative`}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className={`relative w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 ${isActive ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/30 dark:shadow-white/20 scale-110' : 'text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-700/50'}`}>
                    <i className={`fa-solid fa-${item.icon} ${isActive ? 'text-[17px]' : 'text-[19px]'}`}></i>
                    {item.id === 'help' && <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-slate-900 shadow-sm"></span>}
                </div>
                {isActive && (
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