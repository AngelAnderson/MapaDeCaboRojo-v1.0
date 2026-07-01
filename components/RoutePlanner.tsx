import React from 'react';
import { Place } from '../types';

interface RoutePlannerProps {
  stops: Place[];
  onRemoveStop: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const RoutePlanner: React.FC<RoutePlannerProps> = ({ stops, onRemoveStop, onClear, onClose }) => {
  const openGoogleMaps = () => {
    if (stops.length < 2) return;
    const waypoints = stops
      .filter(s => s.coords)
      .map(s => `${s.coords!.lat},${s.coords!.lng}`)
      .join('/');
    window.open(`https://www.google.com/maps/dir/${waypoints}`, '_blank');
  };

  return (
    <div className="fixed bottom-28 left-4 right-4 z-[2000] bg-paper/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 dark:border-line p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm text-ink flex items-center gap-2">
          <i className="fa-solid fa-route text-brand-500"></i> Ruta ({stops.length}/5 paradas)
        </h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink-soft dark:hover:text-white">
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {stops.length === 0 ? (
        <p className="text-xs text-ink-muted text-center py-3">Toca los pins del mapa para agregar paradas</p>
      ) : (
        <div className="space-y-2 mb-3">
          {stops.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 text-sm">
              <span className="w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="flex-1 truncate text-ink font-medium">{s.name}</span>
              <button onClick={() => onRemoveStop(s.id)} className="text-ink-muted hover:text-red-500 shrink-0">
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={onClear} className="flex-1 text-xs font-bold text-ink-muted py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-paper-2 transition-colors">
          Limpiar
        </button>
        <button
          onClick={openGoogleMaps}
          disabled={stops.length < 2}
          className="flex-1 text-xs font-bold text-white py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
        >
          <i className="fa-solid fa-map-location-dot"></i> Ver en Google Maps
        </button>
      </div>
    </div>
  );
};

export default RoutePlanner;
