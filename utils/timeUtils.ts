// timeUtils.ts — Puerto Rico AST time helpers (ported from *7711 bot)

function to12h(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h)) return time;
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m > 0 ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

export function isOpenNow(opening_hours: any): boolean {
  if (!opening_hours?.structured) return true;
  const now = new Date();
  const prString = now.toLocaleString('en-US', { timeZone: 'America/Puerto_Rico' });
  const prDate = new Date(prString);
  const hour = prDate.getHours();
  const minute = prDate.getMinutes();
  const day = prDate.getDay();
  const currentMinutes = hour * 60 + minute;
  const dayEntry = opening_hours.structured.find((d: any) => d.day === day);
  if (!dayEntry) return true;
  if (dayEntry.isClosed) return false;
  const [openH, openM] = (dayEntry.open || '00:00').split(':').map(Number);
  const [closeH, closeM] = (dayEntry.close || '23:59').split(':').map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  if (isNaN(openMin) || isNaN(closeMin)) return true;
  if (closeMin <= openMin) return currentMinutes >= openMin || currentMinutes <= closeMin;
  return currentMinutes >= openMin && currentMinutes <= closeMin;
}

export function formatOpenStatus(opening_hours: any): string | null {
  if (!opening_hours?.structured) return null;
  const now = new Date();
  const prString = now.toLocaleString('en-US', { timeZone: 'America/Puerto_Rico' });
  const prDate = new Date(prString);
  const hour = prDate.getHours();
  const minute = prDate.getMinutes();
  const day = prDate.getDay();
  const currentMinutes = hour * 60 + minute;
  const dayEntry = opening_hours.structured.find((d: any) => d.day === day);
  if (!dayEntry) return null;
  if (dayEntry.isClosed) {
    for (let i = 1; i <= 7; i++) {
      const nextDay = (day + i) % 7;
      const nextEntry = opening_hours.structured.find((d: any) => d.day === nextDay);
      if (nextEntry && !nextEntry.isClosed && nextEntry.open) {
        const dayName = i === 1 ? 'manana' : ['dom','lun','mar','mie','jue','vie','sab'][nextDay];
        return `Cerrado (abre ${dayName} ${to12h(nextEntry.open)})`;
      }
    }
    return 'Cerrado';
  }
  const [openH, openM] = (dayEntry.open || '00:00').split(':').map(Number);
  const [closeH, closeM] = (dayEntry.close || '23:59').split(':').map(Number);
  if (isNaN(openH) || isNaN(closeH)) return null;
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const isOpen = closeMin <= openMin
    ? currentMinutes >= openMin || currentMinutes <= closeMin
    : currentMinutes >= openMin && currentMinutes <= closeMin;
  if (isOpen) return `Abierto (cierra ${to12h(dayEntry.close)})`;
  return `Cerrado (abre ${to12h(dayEntry.open)})`;
}
