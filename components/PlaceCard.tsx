import React from 'react';
import { Place, ParkingStatus } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface PlaceCardProps {
  place: Place;
  allPlaces?: Place[]; // Added for Smart Links
  onSelect?: (place: Place) => void; // Added for Smart Links navigation
  onClose: () => void;
  onNavigate: () => void;
  onAskAi: (question: string) => void;
  onSuggestEdit: () => void;
}

const InfoBadge = ({ icon, label, active, colorClass, darkColorClass }: any) => (
  <div className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-colors ${active ? (colorClass + ' ' + darkColorClass) : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500 opacity-50'}`} role="status" aria-label={`${label}: ${active ? 'Sí' : 'No'}`}>
    <i className={`fa-solid fa-${icon} text-xl mb-1`} aria-hidden="true"></i>
    <span className="text-[10px] font-bold uppercase">{label}</span>
  </div>
);

const ActionButton = ({ icon, label, onClick, disabled, primary }: any) => (
  <button onClick={onClick} disabled={disabled} className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 ${primary ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/20' : 'bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
    <i className={`fa-solid fa-${icon} text-lg mb-1`} aria-hidden="true"></i>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const PlaceCard: React.FC<PlaceCardProps> = ({ place, allPlaces, onSelect, onClose, onNavigate, onAskAi, onSuggestEdit }) => {
  const { t } = useLanguage();

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: place.name, text: `Check this out: ${place.name}`, url: window.location.href });
      } catch (e) { console.log('Share aborted'); }
    } else { alert("Copied!"); }
  };

  const navigationHandler = () => {
      if (place.gmapsUrl) { window.open(place.gmapsUrl, '_blank'); } else { onNavigate(); }
  };

  // --- SMART LINKS LOGIC ---
  // Find up to 3 places with the same category, excluding the current one
  const relatedPlaces = allPlaces 
    ? allPlaces
        .filter(p => p.id !== place.id && p.category === place.category)
        .slice(0, 3) 
    : [];

  return (
    <article className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)] dark:shadow-[0_-10px_40px_rgba(0,0,0,0.6)] z-[2000] animate-slide-up max-h-[90vh] overflow-y-auto flex flex-col transition-colors duration-300" role="dialog" aria-modal="true" aria-labelledby="place-name">
      <button className="sticky top-0 z-20 w-full flex justify-center pt-3 pb-1 bg-gradient-to-b from-black/40 to-transparent focus:outline-none" onClick={onClose} aria-label="Close">
        <div className="w-16 h-1.5 bg-white/80 rounded-full backdrop-blur-md"></div>
      </button>

      {/* Semantic Header */}
      <header className="relative w-full h-72 shrink-0 group">
        <img src={place.imageUrl || 'https://picsum.photos/800/600'} alt={place.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent"></div>
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 bg-black/30 backdrop-blur-md text-white p-3 rounded-full w-10 h-10 flex items-center justify-center hover:bg-black/50 transition-colors z-30 focus:outline-none focus:ring-2 focus:ring-white">
          <i className="fa-solid fa-xmark text-lg" aria-hidden="true"></i>
        </button>
        <div className="absolute bottom-0 left-0 p-6 text-white w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-teal-500/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide shadow-sm">{place.category}</span>
            {place.priceLevel && <span className="bg-slate-800/60 backdrop-blur-sm px-2 py-0.5 rounded-md text-xs font-bold">{place.priceLevel}</span>}
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
          <ActionButton icon="location-arrow" label={t('directions')} onClick={navigationHandler} primary />
          <ActionButton icon="phone" label={t('call')} onClick={() => window.open(`tel:${place.phone}`)} disabled={!place.phone} />
          <ActionButton icon="globe" label={t('website')} onClick={() => window.open(place.website, '_blank')} disabled={!place.website} />
          <ActionButton icon="share-nodes" label={t('share')} onClick={handleShare} />
        </nav>

        <section>
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-2 tracking-wider">{t('the_scoop')}</h3>
          <p className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed">{place.description}</p>
        </section>
        
        {(place.address || place.phone || place.gmapsUrl) && (
            <section className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-600 space-y-3 transition-colors">
                {place.address && (
                    <div className="flex items-start gap-3">
                        <i className="fa-solid fa-map-pin text-teal-600 dark:text-teal-400 mt-1"></i>
                        <div><p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">{t('address')}</p><p className="text-sm text-slate-700 dark:text-slate-200">{place.address}</p></div>
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
            <InfoBadge 
                icon="square-parking" 
                label={place.parking === ParkingStatus.FREE ? 'Free' : 'Paid'} 
                active={true} 
                colorClass={place.parking === ParkingStatus.FREE ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'} 
                darkColorClass={place.parking === ParkingStatus.FREE ? 'dark:bg-green-900/30 dark:border-green-800/30 dark:text-green-300' : 'dark:bg-yellow-900/30 dark:border-yellow-800/30 dark:text-yellow-300'}
            />
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

        {/* --- SMART INTERNAL LINKING SECTION --- */}
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