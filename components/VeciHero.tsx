import React, { useMemo, useState } from 'react';
import { Place } from '../types';
import { isOpenNow } from '../utils/timeUtils';

/**
 * VeciHero — the home stops being "a map you look at" and becomes
 * "the neighbor who answers". First-visit overlay: one question, an input
 * wired to the same engine as *7711 (web-veci), and two live rails built
 * client-side from data already loaded (abierto ahora / verificado reciente).
 * The Leaflet map stays underneath as the second screen.
 */

const WEB_VECI = 'https://vprjteqgmanntvisjrvp.supabase.co/functions/v1/web-veci';

// Suggested queries = real demand (GSC + *7711 top categories, jul 2026)
const CHIPS = ['farmacia', 'plomero', 'restaurantes', 'médico', 'electricista', 'gomera'];

type VeciResult = {
  name: string; phone: string | null; address: string | null;
  website: string | null; rating: number | null;
  sponsor: boolean; verified: boolean;
};

interface Props {
  places: Place[];
  onSelectPlace: (p: Place) => void;
  onClose: () => void;
  onShowNumeros: () => void;
}

const VeciHero: React.FC<Props> = ({ places, onSelectPlace, onClose, onShowNumeros }) => {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [results, setResults] = useState<VeciResult[]>([]);
  const [error, setError] = useState(false);

  const openNow = useMemo(
    () => places
      .filter(p => p.opening_hours && (p.opening_hours.type === '24_7' || isOpenNow(p.opening_hours)))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 6),
    [places],
  );

  const freshWeek = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400_000;
    return places
      .filter(p => p.verified_at && new Date(p.verified_at).getTime() >= cutoff)
      .sort((a, b) => new Date(b.verified_at!).getTime() - new Date(a.verified_at!).getTime())
      .slice(0, 6);
  }, [places]);

  const ask = async (query: string) => {
    const clean = query.trim();
    if (!clean || loading) return;
    setLoading(true); setError(false); setReply(null); setResults([]);
    try {
      const res = await fetch(WEB_VECI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: clean }),
      });
      const data = await res.json();
      setReply(data.reply || null);
      setResults(Array.isArray(data.results) ? data.results.slice(0, 3) : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Match a web-veci result back to a loaded place so "ver en el mapa" works
  const findLocal = (name: string): Place | undefined =>
    places.find(p => p.name.toLowerCase() === name.toLowerCase());

  const railItem = (p: Place, badge: string, badgeClass: string) => (
    <button
      key={p.id}
      onClick={() => { onSelectPlace(p); onClose(); }}
      className="flex items-center justify-between gap-2 w-full text-left px-3 py-2.5 rounded-xl bg-paper-2/60 hover:bg-paper-2 border border-line transition-colors"
    >
      <span className="text-sm font-semibold text-ink truncate">{p.name}</span>
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badgeClass}`}>{badge}</span>
    </button>
  );

  return (
    <div className="bg-paper/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-line flex flex-col overflow-hidden max-h-full">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-ink leading-tight">¿Qué necesitas resolver hoy?</h1>
          <p className="text-xs text-ink-soft mt-1">El Veci te contesta con negocios verificados de Cabo Rojo y el oeste.</p>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="text-ink-muted hover:text-ink p-1 shrink-0">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(q); }}
        className="px-5 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='"plomero", "farmacia abierta", "dónde comer"…'
          className="flex-1 rounded-xl border border-line bg-paper-2/60 px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-bold rounded-xl px-4 text-sm shrink-0"
        >
          {loading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : 'Buscar'}
        </button>
      </form>

      {/* Demand chips */}
      <div className="px-5 pt-2.5 flex flex-wrap gap-1.5">
        {CHIPS.map(c => (
          <button
            key={c}
            onClick={() => { setQ(c); ask(c); }}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 bg-brand-500/10 hover:bg-brand-500/20 rounded-full px-3 py-1.5 transition-colors"
          >
            {c}
          </button>
        ))}
      </div>

      {/* Body: answer OR live rails */}
      <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
        {error && (
          <div className="text-sm text-ink-soft bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
            Se me trabó la búsqueda. Textea tu pregunta al{' '}
            <a className="font-bold text-brand-600" href="https://wa.me/17874177711">787-417-7711</a> y te contesto por ahí.
          </div>
        )}

        {reply !== null && !error && (
          <div className="space-y-3">
            <p className="text-sm text-ink whitespace-pre-line">{reply}</p>
            {results.map((r) => {
              const local = findLocal(r.name);
              return (
                <div key={r.name} className="border border-line rounded-xl p-3 bg-paper-2/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ink">{r.name}</span>
                    {r.sponsor && <span className="text-[10px] font-bold text-amber-600 bg-amber-500/15 rounded-full px-2 py-0.5">★ Vitrina</span>}
                    {r.verified && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/15 rounded-full px-2 py-0.5">✓ Verificado</span>}
                  </div>
                  {r.address && <div className="text-xs text-ink-soft mt-1">{r.address}</div>}
                  <div className="flex gap-2 mt-2">
                    {r.phone && (
                      <a href={`tel:${r.phone}`} className="text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg px-3 py-1.5">
                        <i className="fa-solid fa-phone mr-1"></i>{r.phone}
                      </a>
                    )}
                    {local && (
                      <button onClick={() => { onSelectPlace(local); onClose(); }} className="text-xs font-bold text-brand-600 border border-brand-500/40 rounded-lg px-3 py-1.5 hover:bg-brand-500/10">
                        Ver en el mapa
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {results.length === 0 && (
              <a href="https://wa.me/17874177711" className="inline-block text-xs font-bold text-brand-600 border border-brand-500/40 rounded-lg px-3 py-1.5 hover:bg-brand-500/10">
                Textea al 787-417-7711 y El Veci te lo consigue
              </a>
            )}
          </div>
        )}

        {reply === null && !error && (
          <div className="grid md:grid-cols-2 gap-4">
            {openNow.length > 0 && (
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wide text-ink-muted mb-2">🟢 Abierto ahora</h2>
                <div className="space-y-1.5">
                  {openNow.map(p => railItem(p, 'abierto', 'bg-emerald-500/15 text-emerald-600'))}
                </div>
              </div>
            )}
            {freshWeek.length > 0 && (
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-wide text-ink-muted mb-2">✓ Verificado esta semana</h2>
                <div className="space-y-1.5">
                  {freshWeek.map(p => railItem(p, 'verificado', 'bg-brand-500/15 text-brand-600'))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-line flex items-center justify-between gap-2 text-xs">
        <button onClick={onClose} className="font-bold text-ink-soft hover:text-ink">
          <i className="fa-solid fa-map mr-1.5"></i>Ver el mapa
        </button>
        <button onClick={onShowNumeros} className="font-bold text-ink-soft hover:text-ink">
          📊 El pueblo en números
        </button>
        <a href="https://wa.me/17874177711" className="font-bold text-brand-600 hover:text-brand-500">
          <i className="fa-brands fa-whatsapp mr-1"></i>*7711
        </a>
      </div>
    </div>
  );
};

export default VeciHero;
