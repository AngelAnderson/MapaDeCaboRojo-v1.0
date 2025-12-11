
import React, { useState } from 'react';
import { Place, ParkingStatus, DaySchedule, Coordinates } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

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

const InfoBadge = ({ icon, label, active, colorClass, darkColorClass }: any) => (
  <div className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${active ? (colorClass + ' ' + darkColorClass) : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-50'}`} role="status" aria-label={`${label}: ${active ? 'Sí' : 'No'}`}>
    <i className={`fa-solid fa-${icon} text-xl mb-1`} aria-hidden="true"></i>
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </div>
);

const ActionButton = ({ icon, label, onClick, disabled, primary, color }: any) => (
  <button onClick={onClick} disabled={disabled} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${primary ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' : color ? color : 'bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
    <i className={`fa-solid fa-${icon} text-lg mb-1`} aria-hidden="true"></i>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const HoursDisplay = ({ hours }: { hours: { note?: string, structured?: DaySchedule[], type?: 'fixed' | '24_7' | 'sunrise_sunset' } }) => {
    const { t } = useLanguage();
    const [expanded, setExpanded] = useState(false);
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const now = new Date();
    const todayIdx = now.getDay();
    
    // Helper to convert 24h "14:00" to 12h "2:00 PM"
    const to12h = (timeStr: string) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':').map(Number);
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const h = hours % 12 || 12; // Convert 0 to 12
      const m = minutes.toString().padStart(2, '0');
      return `${h}:${m} ${suffix}`;
    };
    
    let status = { text: "Horario n/a", color: "text-slate-500", bg: "bg-slate-100", icon: "clock" };
    
    // Logic 1: 24/7
    if (hours.type === '24_7') {
        status = { text: t('status_open_24'), color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30", icon: "clock" };
    } 
    // Logic 2: Sunrise to Sunset (Nature)
    else if (hours.type === 'sunrise_sunset') {
        const currentHour = now.getHours();
        // Approximate Daylight: 6 AM to 7 PM (19:00)
        const isDaytime = currentHour >= 6 && currentHour < 19;
        
        if (isDaytime) {
            status = { text: t('status_open_day'), color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30", icon: "sun" };
        } else {
            // Night warning
            status = { text: t('status_caution_night'), color: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-900/30", icon: "triangle-exclamation" };
        }
    }
    // Logic 3: Fixed / Structured Hours
    else if (hours?.structured && hours.structured.length === 7) {
        const today = hours.structured[todayIdx];
        if (today.isClosed) {
            status = { text: "Cerrado Hoy", color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", icon: "clock" };
        } else if (today.open && today.close) {
            const currentMins = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = today.open.split(':').map(Number);
            const [closeH, closeM] = today.close.split(':').map(Number);
            const openMins = openH * 60 + openM;
            const closeMins = closeH * 60 + closeM;
            
            if (currentMins >= openMins && currentMins < closeMins) {
                status = { text: `Abierto • Cierra ${to12h(today.close)}`, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30", icon: "clock" };
            } else {
                status = { text: t('status_closed_now'), color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", icon: "clock" };
            }
        }
    } else if (hours?.note) {
         status = { text: hours.note, color: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-700", icon: "clock" };
    }

    const showExpand = hours.type === 'fixed' || (!hours.type && hours.structured);

    return (
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-600 overflow-hidden">
             <div onClick={() => showExpand && setExpanded(!expanded)} className={`p-4 flex justify-between items-center transition-colors ${showExpand ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600/50' : ''}`}>
                <div className="flex items-center gap-3">
                    <i className={`fa-solid fa-${status.icon} ${status.color}`}></i>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400">Horario</p>
                        <p className={`text-sm font-bold ${status.color}`}>{status.text}</p>
                    </div>
                </div>
                {showExpand && (
                    <i className={`fa-solid fa-chevron-down text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}></i>
                )}
             </div>
             
             {expanded && showExpand && hours?.structured && (
                 <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-600 pt-3">
                     <div className="space-y-2">
                         {hours.structured.map((d, i) => (
                             <div key={i} className={`flex justify-between text-sm ${i === todayIdx ? 'font-bold text-teal-600 dark:text-teal-400' : 'text-slate-600 dark:text-slate-300'}`}>
                                 <span className="w-10">{DAYS[i]}</span>
                                 {d.isClosed ? (
                                     <span className="text-slate-400 italic">Cerrado</span>
                                 ) : (
                                     <span>{to12h(d.open)} - {to12h(d.close)}</span>
                                 )}
                             </div>
                         ))}
                     </div>
                     {hours.note && <div className="mt-3 text-xs text-slate-500 italic border-t border-slate-200 dark:border-slate-600 pt-2">{hours.note}</div>}
                 </div>
             )}
        </div>
    );
};

const PlaceCard: React.FC<PlaceCardProps> = ({ place, allPlaces, onSelect, onClose, onNavigate, onAskAi, onSuggestEdit, isFavorite, onToggleFavorite, userLocation }) => {
  const { t } = useLanguage();
  
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(1) + ' km';
  };

  const handleShare = async () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('place', place.slug || place.id);
    const shareUrl = url.toString();

    if (navigator.share) {
      try {
        await navigator.share({ 
          title: place.name, 
          text: `Chequea este lugar en Cabo Rojo: ${place.name} 🌴`, 
          url: shareUrl 
        });
      } catch (e) { console.log('Share aborted'); }
    } else { 
      navigator.clipboard.writeText(shareUrl);
      alert("Link copiado: " + shareUrl); 
    }
  };

  const navigationHandler = () => {
      if (place.gmapsUrl) { window.open(place.gmapsUrl, '_blank'); } else { onNavigate(); }
  };

  const handleCalendar = () => {
      if (!place.contact_info?.eventStart) return;
      const start = new Date(place.contact_info.eventStart).toISOString().replace(/-|:|\.\d\d\d/g, "");
      const end = place.contact_info.eventEnd 
          ? new Date(place.contact_info.eventEnd).toISOString().replace(/-|:|\.\d\d\d/g, "")
          : new Date(new Date(place.contact_info.eventStart).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
      
      const title = encodeURIComponent(place.name);
      const details = encodeURIComponent(place.description);
      const location = encodeURIComponent(place.address || 'Cabo Rojo, PR');
      const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}&location=${location}`;
      window.open(url, '_blank');
  };

  const relatedPlaces = allPlaces 
    ? allPlaces
        .filter(p => p.id !== place.id && p.category === place.category)
        .slice(0, 3) 
    : [];
  
  const isEvent = place.contact_info?.isEvent === true;
  const isClosed = place.status === 'closed';

  return (
    <article className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.6)] z-[2000] animate-slide-up max-h-[90vh] overflow-y-auto flex flex-col transition-colors duration-300" role="dialog" aria-modal="true" aria-labelledby="place-name">
      <button className="sticky top-0 z-20 w-full flex justify-center pt-3 pb-1 bg-gradient-to-b from-black/40 to-transparent focus:outline-none" onClick={onClose} aria-label="Close">
        <div className="w-16 h-1.5 bg-white/80 rounded-full backdrop-blur-md"></div>
      </button>

      {/* Semantic Header */}
      <header className="relative w-full h-72 shrink-0 group bg-slate-900">
        <img src={place.imageUrl || 'https://picsum.photos/800/600'} alt={place.name} className={`w-full h-full object-cover transition-all ${isClosed ? 'grayscale opacity-60' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
        
        {/* Closed Overlay */}
        {isClosed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-red-600/90 backdrop-blur-sm text-white px-6 py-2 rounded-xl border-2 border-white/20 shadow-2xl transform -rotate-6">
                    <span className="text-xl font-black uppercase tracking-widest">Cerrado</span>
                </div>
            </div>
        )}

        <div className="absolute top-4 right-4 flex gap-3 z-30">
             {onToggleFavorite && (
                <button onClick={onToggleFavorite} className={`w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md transition-colors ${isFavorite ? 'bg-pink-500 text-white' : 'bg-black/30 text-white hover:bg-black/50'}`}>
                    <i className={`fa-${isFavorite ? 'solid' : 'regular'} fa-heart text-lg`}></i>
                </button>
             )}
            <button onClick={onClose} aria-label="Close" className="bg-black/30 backdrop-blur-md text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/50 transition-colors focus:outline-none focus:ring-2 focus:ring-white">
                <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
            </button>
        </div>

        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-teal-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm">{place.category}</span>
            
            {place.isMobile && (
                 <span className="bg-purple-600/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm flex items-center gap-1">
                    <i className="fa-solid fa-truck-fast"></i> Domicilio
                 </span>
            )}

            {place.hasGenerator && (
                 <span className="bg-yellow-500/90 text-black backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm flex items-center gap-1">
                    <i className="fa-solid fa-bolt"></i> Planta Eléctrica
                 </span>
            )}
            
            {userLocation && (
                <span className="bg-slate-700/80 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                    <i className="fa-solid fa-location-arrow text-[10px]"></i>
                    {calculateDistance(userLocation.lat, userLocation.lng, place.coords.lat, place.coords.lng)}
                </span>
            )}

            {isClosed ? (
                <span className="bg-red-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm">Closed</span>
            ) : (
                <>
                    {place.priceLevel && !isEvent && <span className="bg-slate-800/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold">{place.priceLevel}</span>}
                    {isEvent && <span className="bg-purple-600/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase">📅 {place.priceLevel}</span>}
                </>
            )}

            {place.isVerified && <span className="text-blue-400 text-xs flex items-center gap-1"><i className="fa-solid fa-circle-check" aria-hidden="true"></i></span>}
          </div>
          <h1 id="place-name" className="text-3xl font-black leading-tight shadow-black drop-shadow-md">{place.name}</h1>
          {place.vibe && place.vibe.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar" role="list">
              {place.vibe.map((v, i) => <span key={i} className="text-xs font-medium text-slate-200 border border-white/20 px-2 py-0.5 rounded-full whitespace-nowrap" role="listitem">✨ {v}</span>)}
            </div>
          )}
        </div>
      </header>

      <div className="p-6 space-y-6 bg-white dark:bg-slate-800 -mt-4 rounded-t-3xl relative z-10 flex-1 transition-colors duration-300">
        <nav className="flex gap-3">
          {place.isMobile ? (
              <ActionButton 
                icon="phone" 
                label={t('call')} 
                onClick={() => window.open(`tel:${place.phone}`)} 
                primary 
                disabled={!place.phone} 
              />
          ) : (
              <ActionButton icon="location-arrow" label={t('directions')} onClick={navigationHandler} primary />
          )}

          {isEvent ? (
              <ActionButton icon="calendar-plus" label={t('add_to_calendar')} onClick={handleCalendar} color="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800" />
          ) : (
              place.isMobile ? (
                  <ActionButton icon="message" label="WhatsApp" onClick={() => window.open(`https://wa.me/1${place.phone.replace(/\D/g,'')}`, '_blank')} color="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800" disabled={!place.phone} />
              ) : (
                  <ActionButton icon="phone" label={t('call')} onClick={() => window.open(`tel:${place.phone}`)} disabled={!place.phone || isClosed} />
              )
          )}
          <ActionButton icon="share-nodes" label={t('share')} onClick={handleShare} />
        </nav>
        
        {isClosed && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl flex items-center gap-4">
                <i className="fa-solid fa-store-slash text-red-500 text-2xl"></i>
                <div>
                    <h4 className="font-bold text-red-600 dark:text-red-400">Este lugar está cerrado.</h4>
                    <p className="text-xs text-red-500/80 dark:text-red-400/80">Puede ser temporal o permanente. Verifica antes de ir.</p>
                </div>
            </div>
        )}

        <section>
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-wider">{t('the_scoop')}</h3>
          <p className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed">{place.description}</p>
        </section>

        {!isClosed && place.opening_hours && (
            <section>
                <HoursDisplay hours={place.opening_hours} />
            </section>
        )}
        
        {(place.address || place.phone || place.gmapsUrl) && (
            <section className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-3 transition-colors">
                {place.address && (
                    <div className="flex items-start gap-3">
                        {place.isMobile ? (
                            <i className="fa-solid fa-truck-fast text-purple-500 dark:text-purple-400 mt-1"></i>
                        ) : (
                            <i className="fa-solid fa-map-pin text-teal-600 dark:text-teal-400 mt-1"></i>
                        )}
                        <div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
                                {isEvent ? 'Ubicación' : (place.isMobile ? 'Zona de Servicio' : t('address'))}
                            </p>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{place.address}</p>
                        </div>
                    </div>
                )}
                {place.phone && (
                    <div className="flex items-start gap-3 pt-2 border-t border-slate-200 dark:border-slate-600">
                        <i className="fa-solid fa-phone text-teal-600 dark:text-teal-400 mt-1"></i>
                        <div><p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">Teléfono</p><a href={`tel:${place.phone}`} className="text-sm text-teal-600 dark:text-teal-400 font-bold underline">{place.phone}</a></div>
                    </div>
                )}
            </section>
        )}

        <section>
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider">{t('logistics')}</h3>
          <div className="grid grid-cols-4 gap-2">
            {!place.isMobile && (
                <InfoBadge 
                    icon="square-parking" 
                    label={place.parking === ParkingStatus.FREE ? 'Free' : 'Paid'} 
                    active={true} 
                    colorClass={place.parking === ParkingStatus.FREE ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'} 
                    darkColorClass={place.parking === ParkingStatus.FREE ? 'dark:bg-green-900/30 dark:border-green-800/30 dark:text-green-300' : 'dark:bg-yellow-900/30 dark:border-yellow-800/30 dark:text-yellow-300'}
                />
            )}
            
            {place.hasGenerator && (
                <InfoBadge icon="bolt" label="Planta" active={true} colorClass="bg-yellow-100 border-yellow-300 text-yellow-800" darkColorClass="dark:bg-yellow-900/40 dark:border-yellow-600/30 dark:text-yellow-200" />
            )}

            {place.isMobile && (
                <InfoBadge icon="house-user" label="Domicilio" active={true} colorClass="bg-purple-50 border-purple-200 text-purple-700" darkColorClass="dark:bg-purple-900/30 dark:border-purple-800/30 dark:text-purple-300" />
            )}
            <InfoBadge icon="restroom" label="WC" active={place.hasRestroom} colorClass="bg-blue-50 border-blue-200 text-blue-700" darkColorClass="dark:bg-blue-900/30 dark:border-blue-800/30 dark:text-blue-300" />
            <InfoBadge icon="dog" label="Pet" active={place.isPetFriendly} colorClass="bg-orange-50 border-orange-200 text-orange-700" darkColorClass="dark:bg-orange-900/30 dark:border-orange-800/30 dark:text-orange-300" />
            <InfoBadge icon="wheelchair" label="Access" active={place.isHandicapAccessible} colorClass="bg-purple-50 border-purple-200 text-purple-700" darkColorClass="dark:bg-purple-900/30 dark:border-purple-800/30 dark:text-purple-300" />
          </div>
        </section>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/40 dark:to-orange-900/40 p-5 rounded-2xl border border-orange-200 dark:border-orange-800/30 relative overflow-hidden transition-colors">
          <i className="fa-solid fa-lightbulb absolute -right-4 -bottom-4 text-8xl text-orange-200 dark:text-orange-900/50 opacity-50" aria-hidden="true"></i>
          <h3 className="text-orange-800 dark:text-orange-300 font-bold uppercase mb-2 text-sm flex items-center gap-2"><i className="fa-solid fa-user-secret" aria-hidden="true"></i> {t('tip_title')}</h3>
          <p className="text-slate-800 dark:text-slate-200 font-medium relative z-10">{place.tips || "..."}</p>
          <button onClick={() => onAskAi('')} className="mt-4 bg-white/80 dark:bg-slate-700 hover:bg-white dark:hover:bg-slate-600 text-orange-700 dark:text-orange-300 text-sm font-bold py-2 px-4 rounded-xl shadow-sm flex items-center gap-2 transition-colors relative z-10">
            <i className="fa-solid fa-robot" aria-hidden="true"></i> {t('ask_ai')}
          </button>
        </div>

        {relatedPlaces.length > 0 && onSelect && (
          <section className="pt-2">
            <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-3 tracking-wider">Explora También</h3>
            <div className="grid grid-cols-1 gap-2">
              {relatedPlaces.map(rp => (
                <button 
                  key={rp.id}
                  onClick={() => onSelect(rp)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors text-left group"
                >
                  <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                    <img src={rp.imageUrl} alt={rp.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">{rp.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{rp.category}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right text-xs text-slate-400"></i>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-2">
           <button onClick={onSuggestEdit} className="text-slate-400 text-xs font-bold hover:text-teal-600 dark:hover:text-teal-400 transition-colors flex items-center justify-center gap-2 py-2">
             <i className="fa-solid fa-pen-to-square" aria-hidden="true"></i> {t('suggest_edit')}
           </button>
        </footer>
        <div className="h-6"></div>
      </div>
    </article>
  );
};
export default PlaceCard;