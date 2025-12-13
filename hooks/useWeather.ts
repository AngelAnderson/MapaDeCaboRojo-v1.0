
import { useState, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

export interface WeatherState {
  temp: number;
  condition: string;
  advice: string;
  icon: string;
  loading: boolean;
  isSafe: boolean;
}

export const useWeather = () => {
  const { t } = useLanguage();
  const [weather, setWeather] = useState<WeatherState>({
    temp: 0,
    condition: '',
    advice: t('weather_loading'),
    icon: 'fa-sun',
    loading: true,
    isSafe: true,
  });

  const fetchWeather = async () => {
      try {
        const LAT = 18.0262; 
        const LNG = -67.1725;
        const timestamp = new Date().getTime();
        
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=apparent_temperature,weather_code,wind_speed_10m,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FPuerto_Rico&t=${timestamp}`
        );
        const data = await res.json();
        
        const current = data.current;
        const temp = Math.round(current.apparent_temperature);
        const code = current.weather_code;
        const wind = current.wind_speed_10m;
        const isDay = current.is_day === 1;

        let condition = t('weather_sunny');
        let advice = t('weather_advice_beach');
        let icon = isDay ? 'fa-sun' : 'fa-moon';
        let isSafe = true;

        if (code >= 95) {
            condition = t('weather_storm');
            advice = t('weather_advice_storm');
            icon = 'fa-cloud-bolt';
            isSafe = false;
        } else if (code >= 61 || (code >= 80 && code <= 82)) {
            condition = t('weather_rain');
            advice = t('weather_advice_rain');
            icon = 'fa-cloud-showers-heavy';
            isSafe = false;
        } else if (code >= 51) {
            condition = t('weather_drizzle');
            advice = t('weather_advice_drizzle');
            icon = 'fa-cloud-rain';
        } else if (code === 3) {
            condition = t('weather_cloudy');
            advice = t('weather_advice_cloudy');
            icon = 'fa-cloud';
        } else if (code === 2) {
            condition = t('weather_partial_cloudy');
            advice = t('weather_advice_partial_cloudy');
            icon = isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
        } else if (code === 1) {
            condition = t('weather_clear'); 
            advice = t('weather_advice_clear');
            icon = isDay ? 'fa-sun' : 'fa-moon';
        } else {
            condition = isDay ? t('weather_sunny') : t('weather_clear');
            advice = isDay ? t('weather_advice_hot') : t('weather_advice_stars');
            icon = isDay ? 'fa-sun' : 'fa-moon';
        }

        if (temp > 100) {
            advice = t('weather_advice_infernal_heat');
            icon = 'fa-temperature-arrow-up';
        }
        if (wind > 18) {
            advice = t('weather_advice_strong_wind');
            icon = 'fa-wind';
            isSafe = false;
        }

        setWeather({ temp, condition, advice, icon, loading: false, isSafe });

      } catch (e) {
        setWeather({
            temp: 85,
            condition: t('weather_tropical'),
            advice: t('weather_advice_default'),
            icon: 'fa-umbrella-beach',
            loading: false,
            isSafe: true
        });
      }
  };

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 mins
    
    const handleVisibilityChange = () => {
        if (!document.hidden) fetchWeather();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
        clearInterval(interval);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return weather;
};
