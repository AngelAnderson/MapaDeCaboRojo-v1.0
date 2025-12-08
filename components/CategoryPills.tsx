import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface CategoryPillsProps {
  activeGroup: string;
  onSelect: (group: string) => void;
}

const CATEGORY_GROUPS = [
  { key: 'ALL', labelKey: 'cat_all', icon: 'globe', color: 'bg-slate-800 text-white shadow-lg shadow-slate-900/20' },
  { key: 'EXPLORA', labelKey: 'Paseos', icon: 'binoculars', color: 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' },
  { key: 'COMIDA', labelKey: 'cat_food', icon: 'utensils', color: 'bg-[#FF3B30] text-white shadow-lg shadow-red-500/30' },
  { key: 'HOSPEDAJE', labelKey: 'cat_lodging', icon: 'bed', color: 'bg-[#5AC8FA] text-white shadow-lg shadow-cyan-500/30' },
  { key: 'SERVICIOS', labelKey: 'cat_services', icon: 'map-pin', color: 'bg-[#8E8E93] text-white shadow-lg shadow-slate-500/30' },
  { key: 'EVENTOS', labelKey: 'Eventos', icon: 'calendar-star', color: 'bg-[#AF52DE] text-white shadow-lg shadow-purple-500/30' }
];

const CategoryPills: React.FC<CategoryPillsProps> = ({ activeGroup, onSelect }) => {
  const { t } = useLanguage();

  return (
    <div className="w-full overflow-x-auto pb-1 pt-1 no-scrollbar pl-1">
      <div className="flex gap-3 w-max pr-4">
        {CATEGORY_GROUPS.map((group) => {
          const isActive = activeGroup === group.key;
          // Handle dynamic translations vs static labels
          const label = group.labelKey.startsWith('cat_') ? t(group.labelKey as any) : group.labelKey;
          
          return (
            <button
              key={group.key}
              onClick={() => onSelect(group.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-[13px] transition-all duration-300 active:scale-95 whitespace-nowrap ${isActive ? group.color : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              <i className={`fa-solid fa-${group.icon} ${isActive ? 'text-white/90' : 'text-slate-400'}`}></i>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default CategoryPills;