import React, { useEffect, useState } from 'react';
import { getRecentDemand, DemandSignal } from '../services/supabase';

interface Props {
  onSelectTerm?: (term: string) => void;
}

const formatRelative = (iso: string): string => {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffMin = Math.floor((now - then) / 60000);
    if (diffMin < 1) return 'hace seg.';
    if (diffMin < 60) return `hace ${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `hace ${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    return `hace ${diffDay}d`;
  } catch {
    return '';
  }
};

const DemandFeed: React.FC<Props> = ({ onSelectTerm }) => {
  const [items, setItems] = useState<DemandSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getRecentDemand(10);
        if (!cancelled) {
          setItems(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!loading && items.length === 0) return null;

  return (
    <aside
      className={`hidden lg:flex fixed right-4 top-32 z-[1400] flex-col bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-white/60 dark:border-slate-700/50 rounded-2xl shadow-lg overflow-hidden transition-all ${
        collapsed ? 'w-12 h-12' : 'w-72 max-h-[60vh]'
      }`}
      aria-label="Lo que el pueblo busca"
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors w-full text-left"
        aria-expanded={!collapsed}
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
        </span>
        {!collapsed && (
          <>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Lo que el pueblo busca
            </span>
            <i className="fa-solid fa-chevron-up text-[10px] text-slate-400 ml-auto"></i>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="overflow-y-auto flex-1 px-2 py-2 space-y-1">
          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400">
              <i className="fa-solid fa-circle-notch fa-spin mr-1"></i>
              Escuchando…
            </div>
          ) : (
            items.map((it, i) => (
              <button
                key={`${it.term}-${i}`}
                onClick={() => onSelectTerm?.(it.term)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40 transition-colors group"
              >
                <i className="fa-solid fa-magnifying-glass text-[9px] text-slate-400 group-hover:text-teal-500"></i>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate flex-1">
                  {it.term}
                </span>
                {typeof it.result_count === 'number' && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                      it.result_count > 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {it.result_count > 0 ? `${it.result_count}` : 'gap'}
                  </span>
                )}
                <span className="text-[9px] text-slate-400 shrink-0">{formatRelative(it.created_at)}</span>
              </button>
            ))
          )}
        </div>
      )}
      {!collapsed && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500">
          Cada búsqueda al bot *7711 entra acá.
        </div>
      )}
    </aside>
  );
};

export default DemandFeed;
