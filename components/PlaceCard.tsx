import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Place, ParkingStatus, DaySchedule, Coordinates } from '../types';
import { useLanguage } from '../i18n/LanguageContext';
import { checkPublicHolidays, PublicHoliday } from '../services/externalServices';
import { getPlaceHeaderImage } from '../utils/imageOptimizer';
import { formatOpenStatus, isOpenNow } from '../utils/timeUtils';
import { getPlaceReviews, submitReview, PlaceReviewSummary } from '../services/supabase';

// ============================================================================
// PlaceCard — responsive detail view
// ----------------------------------------------------------------------------
// Desktop (>= md): fixed right-side panel, always fully scrollable. No peek.
// Mobile  (<  md): bottom sheet, FULLY EXPANDED by default. Swipe-down closes.
//
// Why this shape: the old card opened collapsed to max-h-[200px] showing only
// the title and "desliza para más". Users read the card as "empty" because the
// content was clipped by CSS. Fix: show everything by default, let mobile users
// swipe-down to dismiss (familiar iOS/Android sheet gesture).
// ============================================================================

interface PlaceCardProps {
  place: Place;
  allPlaces?: Place[];
  onSelect?: (place: Place) => void;
  onClose: () => void;
  onNavigate: () => void;
  onAskAi: (question: string) => void;
  onSuggestEdit: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  userLocation?: Coordinates;
}

// ---------- Skeleton for lazy-loaded detail ---------------------------------
const Skeleton = memo(({ lines = 3, className = '' }: { lines?: number; className?: string }) => (
  <div className={`animate-pulse space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <div key={i} className={`h-3 bg-slate-200 dark:bg-slate-700 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}></div>
    ))}
  </div>
));
Skeleton.displayName = 'Skeleton';

// ---------- Small sub-components (memoized to avoid re-render storms) --------

const InfoBadge = memo(({ icon, label, active, colorClass, darkColorClass }: any) => (
  <div
    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${
      active
        ? `${colorClass} ${darkColorClass}`
        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-50'
    }`}
    role="status"
    aria-label={`${label}: ${active ? 'Sí' : 'No'}`}
  >
    <i className={`fa-solid fa-${icon} text-xl mb-1`} aria-hidden="true"></i>
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </div>
));
InfoBadge.displayName = 'InfoBadge';

interface ActionButtonProps {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  color?: string;
  loading?: boolean;
}
const ActionButton = memo(({ icon, label, onClick, disabled, primary, color, loading }: ActionButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${
      primary
        ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20'
        : color
        ? color
        : 'bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600'
    }`}
  >
    {loading ? (
      <i className="fa-solid fa-circle-notch fa-spin text-lg mb-1"></i>
    ) : (
      <i className={`fa-solid fa-${icon} text-lg mb-1`} aria-hidden="true"></i>
    )}
    <span className="text-xs font-bold">{label}</span>
  </button>
));
ActionButton.displayName = 'ActionButton';

const HoursDisplay = memo(({ hours }: { hours: { note?: string; structured?: DaySchedule[]; type?: 'fixed' | '24_7' | 'sunrise_sunset' } }) => {
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

// ---------- Responsive detection hook ---------------------------------------

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// ---------- Main component ---------------------------------------------------

const CATEGORY_PILL: Record<string, string> = {
  Restaurante: 'bg-orange-500',
  Playa: 'bg-cyan-500',
  Hotel: 'bg-purple-500',
  Farmacia: 'bg-red-500',
  Supermercado: 'bg-emerald-600',
  Bar: 'bg-amber-500',
  Banco: 'bg-blue-600',
  Gasolinera: 'bg-yellow-500',
  Médico: 'bg-rose-500',
};

const getCategoryColor = (cat?: string) => (cat && CATEGORY_PILL[cat]) || 'bg-emerald-500';

// Haversine distance, returns pretty string
const distanceKm = (a: Coordinates, b: Coordinates): string => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return `${(R * c).toFixed(1)} km`;
};

// Normalize a PR phone number for tel: / sms: links (strip non-digits).
const digitsOnly = (phone?: string) => (phone || '').replace(/\D/g, '');

// --- Reviews Sub-Component ---
const ReviewsSection: React.FC<{ placeId: string }> = memo(({ placeId }) => {
  const [data, setData] = useState<PlaceReviewSummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => { getPlaceReviews(placeId).then(setData); }, [placeId]);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await submitReview(placeId, rating, comment, authorName);
      setSubmitted(true);
      setShowForm(false);
      getPlaceReviews(placeId).then(setData);
    } catch (e) {
      console.warn('Review submit failed:', e);
      setComment('Error al enviar. Intenta de nuevo.');
    }
    setSubmitting(false);
  };

  if (!data) return null;

  return (
    <section className="pt-4 border-t border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
          <i className="fa-solid fa-star text-amber-400"></i>
          Reseñas
          {data.count > 0 && <span className="text-xs font-normal text-slate-500">({data.avg_rating} · {data.count})</span>}
        </h4>
        {!showForm && !submitted && (
          <button onClick={() => setShowForm(true)} className="text-xs font-bold text-teal-500 hover:text-teal-600">
            Dejar reseña
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 mb-3 space-y-2">
          <div className="flex gap-1">
            {[1,2,3,4,5].map(s => (
              <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)} onClick={() => setRating(s)} className="text-xl transition-colors">
                <i className={`fa-${(hoverRating || rating) >= s ? 'solid' : 'regular'} fa-star text-amber-400`}></i>
              </button>
            ))}
          </div>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="¿Cómo fue tu experiencia?" className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 resize-none" rows={2} />
          <input value={authorName} onChange={e => setAuthorName(e.target.value)} placeholder="Tu nombre (opcional)" className="w-full text-sm p-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="flex-1 text-xs font-bold text-slate-500 py-2">Cancelar</button>
            <button onClick={handleSubmit} disabled={rating === 0 || submitting} className="flex-1 text-xs font-bold text-white py-2 bg-teal-500 rounded-lg disabled:opacity-40">
              {submitting ? '...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}

      {submitted && <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">¡Gracias por tu reseña!</p>}

      {data.reviews.length > 0 && (
        <div className="space-y-2">
          {data.reviews.slice(0, 5).map(r => (
            <div key={r.id} className="text-xs">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-bold text-slate-700 dark:text-slate-200">{r.author_name}</span>
                <span className="text-amber-400">{'★'.repeat(r.rating)}</span>
                <span className="text-slate-400 ml-auto">{new Date(r.created_at).toLocaleDateString('es-PR', { month: 'short', day: 'numeric' })}</span>
              </div>
              {r.comment && <p className="text-slate-500 dark:text-slate-400">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

const PlaceCard: React.FC<PlaceCardProps> = ({
  place,
  allPlaces,
  onSelect,
  onClose,
  onNavigate,
  onAskAi,
  onSuggestEdit,
  isFavorite,
  onToggleFavorite,
  userLocation,
}) => {
  const { t } = useLanguage();
  const isDesktop = useIsDesktop();

  // Mobile-only dismiss gesture state
  const [dragY, setDragY] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [shareToast, setShareToast] = useState('');

  // ---- Detail loaded sentinel (Phase 3 lazy loading) ----------------------
  const detailLoaded = !!(place as any)?._detailLoaded || !!place?.description;

  // ---- Null-guarded derived values --------------------------------------
  const placeName = place?.name ?? 'Negocio';
  const placeCategory = place?.category ?? '';
  const placeDescription = place?.description ?? '';
  const placeTips = place?.tips ?? '';
  const placeAddress = place?.address ?? '';
  const placePhone = place?.phone ?? '';
  const isEvent = place?.contact_info?.isEvent === true;
  const isClosed = place?.status === 'closed';
  const isMobileBiz = place?.isMobile === true;
  const hasCoords = !!place?.coords;

  // Live status pill (reuses bot *7711's PR-timezone aware helper)
  const liveStatus = useMemo(() => {
    if (isClosed) return { text: t('status_closed') ?? 'Cerrado', open: false };
    const oh = place?.opening_hours;
    if (!oh) return null;
    if (oh.type === '24_7') return { text: '24/7', open: true };
    if (oh.type === 'sunrise_sunset') {
      const h = new Date().getHours();
      return { text: h >= 6 && h < 19 ? 'Abierto (día)' : 'Cerrado (noche)', open: h >= 6 && h < 19 };
    }
    const text = formatOpenStatus(oh);
    if (!text) return null;
    return { text, open: isOpenNow(oh) };
  }, [place?.opening_hours, isClosed, t]);

  // Weather / surf freshness
  const surf = place?.amenities?.surf_report;
  const isWeatherFresh = !!(surf?.updated_at && new Date().getTime() - new Date(surf.updated_at).getTime() < 24 * 60 * 60 * 1000);
  const vibeCheck = place?.amenities?.vibe_check;
  const isVibeFresh = !!vibeCheck?.text;

  // Real image URL only — no more random picsum placeholders. If the business has no photo
  // uploaded, we render the gradient hero below with no <img> at all.
  const heroSrc = getPlaceHeaderImage(place?.imageUrl || '');
  const hasRealImage = !!heroSrc;

  const relatedPlaces = useMemo(() => {
    if (!allPlaces || !place) return [];
    return allPlaces.filter((p) => p.id !== place.id && p.category === place.category).slice(0, 3);
  }, [allPlaces, place]);

  // ---- Handlers (stable refs) -------------------------------------------
  const handleShare = useCallback(async () => {
    try {
      let shareUrl = window.location.href;
      try {
        const url = new URL(window.location.href);
        url.search = '';
        url.searchParams.set('place', place?.slug || place?.id || '');
        shareUrl = url.toString();
      } catch {
        shareUrl = `https://mapadecaborojo.com/?place=${place?.slug || place?.id || ''}`;
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: placeName, text: t('share_text', { name: placeName }), url: shareUrl });
        } catch {}
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareToast('¡Link copiado!');
        setTimeout(() => setShareToast(''), 2500);
      }
    } catch (e) {
      console.warn('share failed', e);
      try {
        await navigator.clipboard.writeText(placeName + ' in Cabo Rojo');
        setShareToast('¡Link copiado!');
        setTimeout(() => setShareToast(''), 2500);
      } catch {}
    }
  }, [place?.id, place?.slug, placeName, t]);

  const handleNavigateClick = useCallback(() => {
    if (place?.gmapsUrl) {
      window.open(place.gmapsUrl, '_blank');
    } else {
      onNavigate();
    }
  }, [place?.gmapsUrl, onNavigate]);

  const handleCall = useCallback(() => {
    const d = digitsOnly(placePhone);
    if (d) window.open(`tel:${d}`);
  }, [placePhone]);

  const handleWhatsApp = useCallback(() => {
    const d = digitsOnly(placePhone);
    if (!d) return;
    // PR numbers are 10-digit; prepend +1 for WhatsApp deeplink
    const intl = d.length === 10 ? `1${d}` : d;
    const msg = encodeURIComponent(`Hola, vi ${placeName} en MapaDeCaboRojo.com y tengo una pregunta.`);
    window.open(`https://wa.me/${intl}?text=${msg}`, '_blank');
  }, [placePhone, placeName]);

  // El Veci SMS deeplink — lockfile rule: full number 787-417-7711, SMS preferred.
  const handleElVeciSMS = useCallback(() => {
    const body = encodeURIComponent(placeName || '');
    window.open(`sms:+17874177711?body=${body}`, '_self');
  }, [placeName]);

  // Mobile swipe-down to close (only active on mobile bottom-sheet layout)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop) return;
      setDragY(e.touches[0].clientY);
      setDragOffset(0);
    },
    [isDesktop],
  );
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop || dragY === null) return;
      const delta = e.touches[0].clientY - dragY;
      if (delta > 0) setDragOffset(delta); // only track downward drag
    },
    [isDesktop, dragY],
  );
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (isDesktop || dragY === null) return;
      const delta = e.changedTouches[0].clientY - dragY;
      setDragY(null);
      setDragOffset(0);
      if (delta > 120) onClose(); // drag > 120px down → dismiss
    },
    [isDesktop, dragY, onClose],
  );

  // ---- Guard: empty place object -----------------------------------------
  if (!place) return null;

  // ---- Container shell (desktop side panel vs mobile bottom sheet) -------
  const desktopShell =
    'fixed top-20 right-4 bottom-20 w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[2000] flex flex-col overflow-hidden animate-slide-up';
  const mobileShell =
    'fixed inset-x-0 bottom-0 top-16 bg-white dark:bg-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.6)] z-[2000] flex flex-col overflow-hidden animate-slide-up';

  const mobileTransform = dragOffset > 0 ? { transform: `translateY(${dragOffset}px)`, transition: 'none' } : undefined;

  return (
    <article
      className={isDesktop ? desktopShell : mobileShell}
      role="dialog"
      aria-modal="true"
      aria-labelledby="place-name"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={mobileTransform}
    >
      {/* Sticky header: drag handle (mobile) + title row (always visible) */}
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-700 pt-2 pb-3 px-5 flex flex-col gap-2 shrink-0">
        {!isDesktop && (
          <div className="flex justify-center pb-1" aria-hidden="true">
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full"></div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 id="place-name" className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate" style={{fontFamily: 'Fraunces, serif'}}>
              {placeName}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {placeCategory && (
                <span className={`text-white text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getCategoryColor(placeCategory)}`}>
                  {placeCategory}
                </span>
              )}
              {userLocation && place.coords && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                  <i className="fa-solid fa-location-arrow text-[9px]"></i>
                  {distanceKm(userLocation, place.coords)}
                </span>
              )}
              {liveStatus && (
                <span
                  className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${
                    liveStatus.open
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full inline-block ${liveStatus.open ? 'bg-emerald-500' : 'bg-red-500'}`}
                  ></span>
                  {liveStatus.text}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                aria-label={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  isFavorite
                    ? 'bg-pink-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-sm`}></i>
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              aria-label={t('close')}
              className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors focus:outline-none"
            >
              <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Hero image — real photo if we have one, otherwise a branded gradient with category icon */}
        <header className="relative w-full h-56 shrink-0 bg-gradient-to-br from-teal-500 via-cyan-500 to-orange-400 overflow-hidden">
          {hasRealImage ? (
            <img
              src={heroSrc}
              alt={placeName}
              className={`w-full h-full object-cover transition-all ${isClosed ? 'grayscale opacity-60' : ''}`}
              style={{ objectPosition: place.imagePosition || 'center' }}
              loading="eager"
              decoding="async"
              onError={(e) => {
                // Image URL is dead — hide the broken img and fall through to the gradient.
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <i className="fa-solid fa-map-location-dot text-white/40 text-8xl" aria-hidden="true"></i>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent"></div>
          {isClosed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-red-600/90 backdrop-blur-sm text-white px-6 py-2 rounded-xl border-2 border-white/20 shadow-2xl transform -rotate-6">
                <span className="text-xl font-black uppercase tracking-widest">{t('status_closed')}</span>
              </div>
            </div>
          )}
          {place.vibe && place.vibe.length > 0 && (
            <div className="absolute bottom-3 left-4 right-4 flex gap-2 overflow-x-auto no-scrollbar">
              {place.vibe.map((v, i) => (
                <span
                  key={`${v}-${i}`}
                  className="text-xs font-medium text-slate-200 border border-white/20 px-2 py-0.5 rounded-full whitespace-nowrap bg-black/30 backdrop-blur-sm"
                >
                  ✨ {v}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="p-5 space-y-5 bg-white dark:bg-slate-800">
          {/* Action row — context-aware */}
          <nav className="grid grid-cols-4 gap-2">
            {isMobileBiz ? (
              <ActionButton
                icon="phone"
                label={t('call')}
                onClick={handleCall}
                primary
                disabled={!placePhone}
              />
            ) : (
              <ActionButton
                icon="location-arrow"
                label={t('directions')}
                onClick={handleNavigateClick}
                primary
                disabled={!hasCoords && !place.gmapsUrl}
              />
            )}
            {placePhone && !isMobileBiz && <ActionButton icon="phone" label={t('call')} onClick={handleCall} />}
            {placePhone && (
              <ActionButton
                icon="whatsapp"
                label="WhatsApp"
                onClick={handleWhatsApp}
                color="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
              />
            )}
            <ActionButton icon="share-nodes" label={t('share')} onClick={handleShare} />
            <ActionButton
              icon="robot"
              label="El Veci"
              onClick={handleElVeciSMS}
              color="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300"
            />
          </nav>

          {/* Closed banner */}
          {isClosed && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl flex items-center gap-4">
              <i className="fa-solid fa-store-slash text-red-500 text-2xl"></i>
              <div>
                <h4 className="font-bold text-red-600 dark:text-red-400">{t('place_closed_title')}</h4>
                <p className="text-xs text-red-500/80 dark:text-red-400/80">{t('place_closed_info')}</p>
              </div>
            </div>
          )}

          {/* Vibe check */}
          {isVibeFresh && vibeCheck && (
            <section className="bg-gradient-to-r from-fuchsia-50 to-pink-50 dark:from-fuchsia-900/20 dark:to-pink-900/20 p-4 rounded-2xl border border-fuchsia-100 dark:border-fuchsia-800/50 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <i className="fa-solid fa-bolt text-4xl text-fuchsia-500"></i>
              </div>
              <div className="relative z-10">
                <h3 className="text-xs font-black text-fuchsia-600 dark:text-fuchsia-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                  <i className="fa-solid fa-bolt"></i> Vibe Check
                </h3>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 italic leading-relaxed">"{vibeCheck.text}"</p>
                <p className="text-[9px] text-fuchsia-400/70 mt-1 text-right">Updated via El Veci</p>
              </div>
            </section>
          )}

          {/* Description — skeleton while detail loads */}
          <section>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-wider">{t('the_scoop')}</h3>
            {detailLoaded ? (
              placeDescription ? <p className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed">{placeDescription}</p> : null
            ) : (
              <Skeleton lines={3} />
            )}
          </section>

          {/* Related people */}
          {place.relatedPeople && place.relatedPeople.length > 0 && (
            <section>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                <i className="fa-solid fa-user-group"></i> Gente Importante
              </h3>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {place.relatedPeople.map((person) => (
                  <div
                    key={person.id}
                    className="min-w-[240px] bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 border border-slate-100 dark:border-slate-600 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden shrink-0">
                      {person.imageUrl ? (
                        <img src={person.imageUrl} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <i className="fa-solid fa-user"></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-white text-sm truncate">{person.name}</h4>
                      <p className="text-xs text-teal-600 dark:text-teal-400 font-bold uppercase truncate">{person.role}</p>
                      {person.years && <p className="text-[10px] text-slate-500">{person.years}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Hours — full schedule only available after detail load */}
          {!isClosed && (
            <section>
              {detailLoaded && place.opening_hours ? (
                <HoursDisplay hours={place.opening_hours} />
              ) : !detailLoaded ? (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 p-4">
                  <Skeleton lines={2} />
                </div>
              ) : null}
            </section>
          )}

          {/* Contact block — deferred until detail loads */}
          {detailLoaded && (placeAddress || placePhone || place.gmapsUrl) && (
            <section className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-3 transition-colors">
              {placeAddress && (
                <div className="flex items-start gap-3">
                  {isMobileBiz ? (
                    <i className="fa-solid fa-truck-fast text-purple-500 dark:text-purple-400 mt-1"></i>
                  ) : (
                    <i className="fa-solid fa-map-pin text-teal-600 dark:text-teal-400 mt-1"></i>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                      {isEvent ? t('event_location') : isMobileBiz ? t('service_area') : t('address')}
                    </p>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{placeAddress}</p>
                  </div>
                </div>
              )}
              {placePhone && (
                <div className="flex items-start gap-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                  <i className="fa-solid fa-phone text-teal-600 dark:text-teal-400 mt-1"></i>
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">{t('phone')}</p>
                    <a href={`tel:${digitsOnly(placePhone)}`} className="text-sm text-teal-600 dark:text-teal-400 font-bold underline">
                      {placePhone}
                    </a>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Weather / surf */}
          {isWeatherFresh && surf && (
            <section className="bg-cyan-50 dark:bg-cyan-900/20 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-800/50 space-y-3 transition-colors">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <i className="fa-solid fa-water"></i> Marine Conditions
                </h3>
                <span className="text-[10px] text-cyan-500/80 bg-cyan-100 dark:bg-cyan-900/40 px-2 py-0.5 rounded-full">Live</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Surf</p>
                  <p className="text-lg font-black text-cyan-700 dark:text-cyan-300">{surf.waves}</p>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Condition</p>
                  <p className="text-xs font-bold text-cyan-700 dark:text-cyan-300 mt-1">{surf.condition}</p>
                </div>
                <div className="bg-white/60 dark:bg-slate-800/60 p-2 rounded-xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">UV</p>
                  <p className={`text-lg font-black ${surf.uv > 7 ? 'text-red-500' : 'text-cyan-700 dark:text-cyan-300'}`}>{surf.uv}</p>
                </div>
              </div>
              <p className="text-[10px] text-center text-cyan-600/60 dark:text-cyan-400/60 italic">Wind: {surf.wind}</p>
            </section>
          )}

          {/* Logistics badges — deferred until detail */}
          {detailLoaded && <section>
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider">{t('logistics')}</h3>
            <div className="grid grid-cols-4 gap-2">
              {!isMobileBiz && (
                <InfoBadge
                  icon="square-parking"
                  label={t('parking_label', { status: place.parking === ParkingStatus.FREE ? 'free' : 'paid' })}
                  active={true}
                  colorClass={place.parking === ParkingStatus.FREE ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}
                  darkColorClass={place.parking === ParkingStatus.FREE ? 'dark:bg-green-900/30 dark:border-green-800/30 dark:text-green-300' : 'dark:bg-yellow-900/30 dark:border-yellow-800/30 dark:text-yellow-300'}
                />
              )}
              {place.hasGenerator && (
                <InfoBadge
                  icon="bolt"
                  label={t('generator')}
                  active={true}
                  colorClass="bg-yellow-100 border-yellow-300 text-yellow-800"
                  darkColorClass="dark:bg-yellow-900/40 dark:border-yellow-600/30 dark:text-yellow-200"
                />
              )}
              {isMobileBiz && (
                <InfoBadge
                  icon="house-user"
                  label={t('delivery_label')}
                  active={true}
                  colorClass="bg-purple-50 border-purple-200 text-purple-700"
                  darkColorClass="dark:bg-purple-900/30 dark:border-purple-800/30 dark:text-purple-300"
                />
              )}
              <InfoBadge icon="restroom" label={t('restroom_label')} active={place.hasRestroom} colorClass="bg-blue-50 border-blue-200 text-blue-700" darkColorClass="dark:bg-blue-900/30 dark:border-blue-800/30 dark:text-blue-300" />
              <InfoBadge icon="dog" label={t('pet_friendly_label')} active={place.isPetFriendly} colorClass="bg-orange-50 border-orange-200 text-orange-700" darkColorClass="dark:bg-orange-900/30 dark:border-orange-800/30 dark:text-orange-300" />
              <InfoBadge icon="wheelchair" label={t('accessibility_label')} active={place.isHandicapAccessible} colorClass="bg-purple-50 border-purple-200 text-purple-700" darkColorClass="dark:bg-purple-900/30 dark:border-purple-800/30 dark:text-purple-300" />
            </div>
          </section>}

          {/* Insider tip — deferred */}
          {detailLoaded && placeTips && (
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/40 p-5 rounded-2xl border border-orange-200 dark:border-orange-800/30 relative overflow-hidden transition-colors">
              <i className="fa-solid fa-lightbulb absolute -right-4 -bottom-4 text-8xl text-orange-200 dark:text-orange-900/50 opacity-50" aria-hidden="true"></i>
              <h3 className="text-orange-800 dark:text-orange-300 font-bold uppercase mb-2 text-sm flex items-center gap-2">
                <i className="fa-solid fa-user-secret" aria-hidden="true"></i> {t('tip_title')}
              </h3>
              <p className="text-slate-800 dark:text-slate-200 font-medium relative z-10">{placeTips}</p>
              <button
                onClick={() => onAskAi('')}
                className="mt-4 bg-white/80 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 text-orange-700 dark:text-orange-300 text-sm font-bold py-2 px-4 rounded-xl shadow-sm flex items-center gap-2 transition-colors relative z-10"
              >
                <i className="fa-solid fa-robot" aria-hidden="true"></i> {t('ask_ai')}
              </button>
            </div>
          )}

          {/* Related places */}
          {relatedPlaces.length > 0 && onSelect && (
            <section className="pt-2">
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider">{t('explore_also')}</h3>
              <div className="grid grid-cols-1 gap-2">
                {relatedPlaces.map((rp) => (
                  <button
                    key={rp.id}
                    onClick={() => onSelect(rp)}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-left group"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 overflow-hidden shrink-0 flex items-center justify-center">
                      {rp.imageUrl ? (
                        <img
                          src={getPlaceHeaderImage(rp.imageUrl)}
                          alt={rp.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <i className="fa-solid fa-map-pin text-white/60 text-sm" aria-hidden="true"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {rp.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rp.category}</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Reviews Section */}
          <ReviewsSection placeId={place.id} />

          <footer className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
            <button
              onClick={onSuggestEdit}
              className="text-slate-400 text-xs font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center justify-center gap-2 py-2"
            >
              <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> {t('btn_suggest')}
            </button>
          </footer>
          <div className="h-6"></div>
        </div>
      </div>
      {shareToast && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 animate-bounce-in">
          {shareToast}
        </div>
      )}
    </article>
  );
};

export default memo(PlaceCard);
