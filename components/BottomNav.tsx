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
    { id: 'map',     label: t('nav_map'),  icon: 'map',           isTab: true,  action: ''             },
    { id: 'explore', label: 'Explorar',    icon: 'compass',       isTab: true,  action: ''             },
    { id: 'event',   label: 'Evento',      icon: 'calendar-plus', isTab: false, action: 'submit_event' },
    { id: 'concierge', label: 'El Veci',   icon: 'comments',      isTab: false, action: 'help'         },
  ];

  return (
    <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[3000] w-[84%] max-w-xs" aria-label="Main Navigation">
      {/* Floating Glass Bubble */}
      <div className="glass-strong shadow-e4 rounded-pill px-3 py-3 flex justify-evenly items-center transition-colors duration-500">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const isConcierge = item.id === 'concierge';

          return (
            <button
              key={item.id}
              onClick={() => item.isTab ? onTabChange(item.id) : onAction(item.action)}
              className="flex flex-col items-center justify-center gap-1 w-16 transition-all active:scale-90 group relative"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300
                  ${isConcierge
                    ? 'bg-brand-500 text-white shadow-e2 shadow-brand-500/40 hover:bg-brand-600'
                    : isActive
                      ? 'bg-ink text-canvas shadow-e2 scale-110'
                      : 'text-ink-muted hover:bg-paper-2'
                  }`}
              >
                <i className={`fa-solid fa-${item.icon} ${isActive || isConcierge ? 'text-[17px]' : 'text-[19px]'}`}></i>
                {isConcierge && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-gold-400 rounded-full border-2 border-paper shadow-sm animate-pulse-dot"></span>
                )}
              </div>
              {isActive && !isConcierge && (
                <span className="absolute -bottom-8 bg-ink text-canvas text-2xs font-bold px-2 py-0.5 rounded-md animate-fade-in shadow-e1 pointer-events-none">
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
