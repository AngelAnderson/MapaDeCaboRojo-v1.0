
import React, { useEffect, useState } from 'react';

interface WeatherState {
  temp: number;
  condition: string;
  advice: string;
  icon: string;
  loading: boolean;
}

const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherState>({
    temp: 0,
    condition: '',
    advice: 'Cargando el clima...',
    icon: 'fa-sun',
    loading: true,
  });

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        // COORDINATES UPDATE: Switched from Town Center (Inland) to Boquerón (Coast)
        // This gives a more accurate "Beach Weather" reading which is usually sunnier.
        const LAT = 18.0262; 
        const LNG = -67.1725;
        
        const timestamp = new Date().getTime();
        
        // Added 'apparent_temperature' (Feels Like) & 'is_day'
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FPuerto_Rico&t=${timestamp}`
        );
        const data = await res.json();
        
        const current = data.current;
        const temp = Math.round(current.apparent_temperature); // Using Heat Index
        const code = current.weather_code;
        const wind = current.wind_speed_10m;
        const isDay = current.is_day === 1;

        let condition = 'Soleado';
        let advice = 'Día perfecto para la playa. Ponte bloqueador.';
        let icon = isDay ? 'fa-sun' : 'fa-moon';

        // Refined WMO Weather Code Interpretation
        if (code >= 95) {
            condition = 'Tormenta';
            advice = '¡Truenos! Salte del agua ya.';
            icon = 'fa-cloud-bolt';
        } else if (code >= 61 || (code >= 80 && code <= 82)) {
            condition = 'Lluvia';
            advice = 'Está lloviendo. Cuidado con los patinazos.';
            icon = 'fa-cloud-showers-heavy';
        } else if (code >= 51) {
            condition = 'Llovizna';
            advice = 'Una llovizna boba. Se quita rápido.';
            icon = 'fa-cloud-rain';
        } else if (code === 3) {
            condition = 'Nublado';
            advice = 'Bueno para caminar, el sol no pica tanto.';
            icon = 'fa-cloud';
        } else if (code === 2) {
            condition = 'Parcialmente Soleado';
            advice = 'Sol con algunas nubes. Rico.';
            icon = isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
        } else if (code === 1) {
            condition = 'Mayormente Despejado'; 
            advice = 'Casi ni hay nubes. Aprovecha.';
            icon = isDay ? 'fa-sun' : 'fa-moon';
        } else {
            // Code 0
            condition = isDay ? 'Soleado' : 'Despejado';
            advice = isDay ? 'Día brillante. ¡A la playa!' : 'Noche clara, perfecta para observar estrellas.';
            icon = isDay ? 'fa-sun' : 'fa-moon';
        }

        // Extreme Conditions Overrides
        if (temp > 100) {
            advice = '¡Calor extremo! Hidrátate bien.';
            icon = 'fa-temperature-arrow-up';
        }
        if (wind > 16) {
            advice = 'Mucho viento. Cuidado con el oleaje.';
            icon = 'fa-wind';
        }

        setWeather({ temp, condition, advice, icon, loading: false });

      } catch (e) {
        setWeather({
            temp: 85,
            condition: 'Tropical',
            advice: 'El clima de siempre: Calor y playa.',
            icon: 'fa-umbrella-beach',
            loading: false
        });
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 mins
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

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-white/50 dark:border-slate-700 pointer-events-auto animate-float flex items-center gap-4 max-w-[280px]">
        <div className="flex flex-col items-center justify-center w-12 text-center">
            <i className={`fa-solid ${weather.icon} text-3xl ${weather.icon.includes('moon') ? 'text-purple-400' : 'text-orange-500'} mb-1`}></i>
            <span className="text-xl font-black text-slate-800 dark:text-white leading-none">{weather.temp}°</span>
        </div>
        <div className="flex-1 border-l border-slate-200 dark:border-slate-700 pl-3">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">{weather.condition}</p>
            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-tight">{weather.advice}</p>
        </div>
    </div>
  );
};

export default WeatherWidget;
