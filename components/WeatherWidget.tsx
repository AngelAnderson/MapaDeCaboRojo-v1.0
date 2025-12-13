
import React, { useEffect, useState } from 'react';
import { getRecentEarthquakes, EarthQuake } from '../services/externalServices';
import { useLanguage } from '../i18n/LanguageContext';
import { WeatherState } from '../hooks/useWeather';

interface WeatherWidgetProps {
  weather: WeatherState;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather }) => {
  const { t } = useLanguage();
  const [quake, setQuake] = useState<EarthQuake | null>(null);

  const fetchQuakes = async () => {
      const q = await getRecentEarthquakes();
      // Only show if Magnitude is > 5.0 (Significant) AND happened in last 6 hours
      if (q && q.mag >= 5.0 && (Date.now() - q.time < 6 * 60 * 60 * 1000)) {
          setQuake(q);
      } else {
          setQuake(null);
      }
  };

  useEffect(() => {
    fetchQuakes();
    const interval = setInterval(fetchQuakes, 600000); // 10 mins
    return () => clearInterval(interval);
  }, []); 

  if (weather.loading) {
      return (
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800 pointer-events-auto animate-pulse flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
             <div className="space-y-1">
                 <div className="w-16 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                 <div className="w-24 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
             </div>
        </div>
      );
  }

  const isAlertMode = !!quake;

  return (
    <div className={`backdrop-blur-md p-3 rounded-2xl shadow-xl border pointer-events-auto animate-float flex items-center gap-4 max-w-[280px] transition-colors duration-500 ${
        isAlertMode 
        ? 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-200 dark:border-amber-700/50' 
        : `bg-white/95 dark:bg-slate-900/95 ${weather.isSafe ? 'border-white/50 dark:border-slate-700' : 'border-red-500/50 dark:border-red-500/30'}`
    }`}>
        {isAlertMode ? (
            <>
                <div className="flex flex-col items-center justify-center w-12 text-center shrink-0">
                    <i className="fa-solid fa-house-crack text-3xl text-amber-600 dark:text-amber-500 mb-1 animate-bob"></i>
                    <span className="text-sm font-black text-amber-800 dark:text-amber-400 leading-none">{quake!.mag.toFixed(1)}</span>
                </div>
                <div className="flex-1 border-l border-amber-200 dark:border-amber-800 pl-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-0.5">{t('earthquake_alert')}</p>
                    </div>
                    <p className="text-[10px] text-amber-800 dark:text-amber-200 font-medium leading-tight truncate">{quake!.place}</p>
                    <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">{new Date(quake!.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
            </>
        ) : (
            <>
                <div className="flex flex-col items-center justify-center w-12 text-center shrink-0">
                    <i className={`fa-solid ${weather.icon} text-3xl ${weather.isSafe ? (weather.icon.includes('moon') ? 'text-purple-400' : 'text-orange-500') : 'text-slate-500'} mb-1`}></i>
                    <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{weather.temp}°</span>
                </div>
                <div className="flex-1 border-l border-slate-200 dark:border-slate-700 pl-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{weather.condition}</p>
                        {!weather.isSafe && <i className="fa-solid fa-triangle-exclamation text-amber-500 text-xs animate-pulse"></i>}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight truncate">{weather.advice}</p>
                </div>
            </>
        )}
    </div>
  );
};

export default WeatherWidget;
