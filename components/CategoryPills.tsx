
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Category } from '../types';
import { DEFAULT_CATEGORIES, CATEGORY_COLORS } from '../constants';

interface CategoryPillsProps {
  activeGroup: string;
  onSelect: (group: string) => void;
  categories?: Category[]; // Make optional to support fallback
}

const CategoryPills: React.FC<CategoryPillsProps> = ({ activeGroup, onSelect, categories = DEFAULT_CATEGORIES }) => {
  const { language, t } = useLanguage();

  // Combine static groups (All, Favs, Events) with dynamic DB categories
  const allGroups = [
      { key: 'ALL', label: t('cat_all'), icon: 'globe', color: 'bg-slate-800 text-white shadow-lg shadow-slate-900/20' },
      ...categories.map(cat => ({
          key: cat.id,
          label: language === 'es' ? cat.label_es : cat.label_en,
          icon: cat.icon,
          color: cat.color // Store hex
      })),
      { key: 'EVENTOS', label: 'Eventos', icon: 'calendar-star', color: 'bg-[#AF52DE] text-white shadow-lg shadow-purple-500/30' },
      { key: 'FAVORITES', label: t('cat_favorites'), icon: 'heart', color: 'bg-pink-600 text-white shadow-lg shadow-pink-500/30' }
  ];

  return (
    <div className="w-full overflow-x-auto pb-1 pt-1 no-scrollbar pl-1">
      <div className="flex gap-3 w-max pr-4">
        {allGroups.map((group) => {
          const isActive = activeGroup === group.key;
          
          let style: React.CSSProperties = {};
          let className = `flex items-center gap-2 px-4 py-2.5 rounded-full font-semibold text-[13px] transition-all duration-300 active:scale-95 whitespace-nowrap `;

          if (isActive) {
              if (group.color.startsWith('#')) {
                  // Hex Color from DB or Fallback
                  style = { backgroundColor: group.color, color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };
              } else {
                  // Tailwind classes (for ALL, EVENTOS, FAVS)
                  className += group.color;
              }
          } else {
              // Inactive State
              className += 'bg-slate-100 text-slate-500 hover:bg-slate-200';
          }

          // Special Fallback: If DB category but list is missing color (rare), use constant
          if (isActive && !style.backgroundColor && group.key !== 'ALL' && group.key !== 'EVENTOS' && group.key !== 'FAVORITES') {
             const fallbackColor = CATEGORY_COLORS[group.key];
             if (fallbackColor) {
                 style = { backgroundColor: fallbackColor, color: 'white', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' };
             }
          }

          return (
            <button
              key={group.key}
              onClick={() => onSelect(group.key)}
              style={style}
              className={className}
            >
              <i className={`fa-solid fa-${group.icon} ${isActive ? 'text-white/90' : 'text-slate-400'}`}></i>
              {group.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
export default CategoryPills;
