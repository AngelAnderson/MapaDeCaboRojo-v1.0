// 5 oct 2026 (dale de Angel): en el celular la puerta del Veci es SMS. Primerizos por SMS vuelven
// 15.4% a 30 días vs 6.5% por WhatsApp (n=337/649). En computadora sms: no abre, se queda WhatsApp.
// Misma regla que veciSmsScript() en api/_lib/hoja-llamada.ts (páginas del servidor).
export function veciHref(text?: string): string {
  const mobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
  const t = text ? encodeURIComponent(text) : '';
  if (mobile) return `sms:+17874177711${t ? `?&body=${t}` : ''}`;
  return `https://wa.me/17874177711${t ? `?text=${t}` : ''}`;
}
