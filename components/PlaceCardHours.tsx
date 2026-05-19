// PlaceCardHours.tsx — extracted from PlaceCard.tsx (Sugg #4 refactor).
// Self-contained hours display with PR holiday awareness + today highlight + expand/collapse.
import React, { memo, useEffect, useState } from 'react';
import { DaySchedule } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { checkPublicHolidays, PublicHoliday } from '../services/externalServices';

interface HoursDisplayProps {
  hours: { note?: string; structured?: DaySchedule[]; type?: 'fixed' | '24_7' | 'sunrise_sunset' };
}

const HoursDisplay = memo<HoursDisplayProps>(({ hours }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [holiday, setHoliday] = useState<PublicHoliday | null>(null);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const todayIdx = now.getDay();

  useEffect(() => {
    checkPublicHolidays().then(setHoliday);
  }, []);

  const to12h = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return '';
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return '';
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${suffix}`;
  };

  let status = { text: t('hours_na'), color: 'text-slate-500', bg: 'bg-slate-100', icon: 'clock' };

  if (hours?.type === '24_7') {
    status = { text: t('status_open_24'), color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'clock' };
  } else if (hours?.type === 'sunrise_sunset') {
    const currentHour = now.getHours();
    const isDaytime = currentHour >= 6 && currentHour < 19;
    if (isDaytime) {
      status = { text: t('status_open_day'), color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'sun' };
    } else {
      status = { text: t('status_caution_night'), color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'triangle-exclamation' };
    }
  } else if (hours?.structured) {
    const today = hours.structured.find((d: any) => d.day === todayIdx) || hours.structured[todayIdx];
    if (!today) {
      status = { text: t('hours_not_available'), color: 'text-slate-400', bg: 'bg-slate-100', icon: 'clock' };
    } else if (today.isClosed) {
      status = { text: t('status_closed_today'), color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'clock' };
    } else if (today.open && today.close) {
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [openH, openM] = today.open.split(':').map(Number);
      const [closeH, closeM] = today.close.split(':').map(Number);
      if (!isNaN(openH) && !isNaN(openM) && !isNaN(closeH) && !isNaN(closeM)) {
        const openMins = openH * 60 + openM;
        const closeMins = closeH * 60 + closeM;
        if (currentMins >= openMins && currentMins < closeMins) {
          status = { text: t('status_open_now', { time: to12h(today.close) }), color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', icon: 'clock' };
        } else {
          status = { text: t('status_closed_now'), color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', icon: 'clock' };
        }
      }
    }
  } else if (hours?.note) {
    status = { text: hours.note, color: 'text-slate-600', bg: 'bg-slate-100 dark:bg-slate-700', icon: 'clock' };
  }

  const showExpand = hours?.type === 'fixed' || (!hours?.type && !!hours?.structured);

  return (
    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 overflow-hidden">
      <div onClick={() => showExpand && setExpanded(!expanded)} className={`p-4 flex justify-between items-center transition-colors ${showExpand ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50' : ''}`}>
        <div className="flex items-center gap-3">
          <i className={`fa-solid fa-${status.icon} ${status.color}`}></i>
          <div>
            <p className="text-xs font-bold uppercase text-slate-400">{t('hours')}</p>
            <p className={`text-sm font-bold ${status.color}`}>{status.text}</p>
          </div>
        </div>
        {showExpand && <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}></i>}
      </div>

      {holiday && (
        <div className="px-4 pb-2">
          <div className="bg-amber-100/50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-2 flex items-center gap-2">
            <i className="fa-solid fa-calendar-day text-amber-600 dark:text-amber-400"></i>
            <p className="text-[10px] text-amber-800 dark:text-amber-200 font-bold">{t('holiday_warning', { name: holiday.localName })}</p>
          </div>
        </div>
      )}

      {expanded && showExpand && hours?.structured && (
        <div className="px-4 pb-4 pt-2">
          <div className="space-y-2 border-t border-slate-200 dark:border-slate-600 pt-3">
            {hours.structured.map((d, i) => (
              <div key={i} className={`flex justify-between text-sm ${i === todayIdx ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>
                <span className="w-10">{DAYS[i]}</span>
                {d.isClosed ? <span className="text-slate-400 italic">{t('status_closed')}</span> : <span>{to12h(d.open)} - {to12h(d.close)}</span>}
              </div>
            ))}
          </div>
          {hours.note && <div className="mt-3 text-xs text-slate-500 italic border-t border-slate-200 dark:border-slate-600 pt-2">{hours.note}</div>}
        </div>
      )}
    </div>
  );
});
HoursDisplay.displayName = 'HoursDisplay';

export default HoursDisplay;
