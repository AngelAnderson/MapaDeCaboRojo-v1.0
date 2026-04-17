import React, { useState, useEffect } from 'react';
import { getSearchTrends } from '../services/supabase';

interface SearchTrendsProps {
  onSelectTerm: (term: string) => void;
}

interface TrendItem {
  term: string;
  searches: number;
  unique_users: number;
}

const SearchTrends: React.FC<SearchTrendsProps> = ({ onSelectTerm }) => {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getSearchTrends(7).then(data => {
      setTrends(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (trends.length === 0) return null;

  const visible = expanded ? trends : trends.slice(0, 5);

  return (
    <div className="px-1 py-2">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
        <span>🔥</span> Tendencias esta semana
        <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-[8px]`}></i>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((t, i) => (
          <button
            key={t.term}
            onClick={() => onSelectTerm(t.term)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-teal-100 dark:hover:bg-teal-900 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
          >
            {i < 3 && <span>🔥</span>}
            {t.term}
            <span className="text-[10px] text-slate-400">({t.searches})</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchTrends;
