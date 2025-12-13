
import React, { useState, useRef } from 'react';
import { createPlace, uploadImage } from '../services/supabase';
import { moderateUserContent } from '../services/aiService';
import { findCoordinates } from '../services/placesService';
import { PlaceCategory, ParkingStatus } from '../types';
import Button from './Button';
import { useLanguage } from '../i18n/LanguageContext';

const SuggestPage: React.FC = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false);
  const [resolvingCoords, setResolvingCoords] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>(PlaceCategory.FOOD);
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [hoursType, setHoursType] = useState<'fixed' | '24_7' | 'sunrise_sunset'>('fixed');
  const [hoursNote, setHoursNote] = useState('');
  const [parking, setParking] = useState<ParkingStatus>(ParkingStatus.FREE);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) {
              alert(t('suggest_image_too_large'));
              return;
          }
          setImageFile(file);
      }
  };

  const handleGoHome = () => {
      window.location.href = '/';
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert(t('suggest_name_required'));
      return;
    }
    
    setAnalyzing(true);
    const moderation = await moderateUserContent(name, description);
    setAnalyzing(false);

    if (!moderation.safe) {
        alert(t('suggest_ai_bouncer_alert', { reason: moderation.reason || t('suggest_ai_bouncer_default_reason') }));
        return;
    }

    setLoading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const up = await uploadImage(imageFile);
        if (up.success && up.url) imageUrl = up.url;
        else {
          alert(up.error || t('suggest_image_upload_error'));
          setLoading(false);
          return;
        }
      }

      let resolvedCoords;
      if (gmapsUrl.trim()) {
        setResolvingCoords(true);
        const coordsResult = await findCoordinates(gmapsUrl);
        if (coordsResult) {
          resolvedCoords = coordsResult;
        }
        setResolvingCoords(false);
      }
      
      const res = await createPlace({
        name, category, gmapsUrl, address: '', description, tips: '', imageUrl, phone, website, parking, hasRestroom, isPetFriendly,
        status: 'pending', coords: resolvedCoords, is_featured: false, sponsor_weight: 0, isVerified: false,
        tags: ['User Suggestion', 'Mobile Page'],
        opening_hours: { type: hoursType, note: hoursNote }
      });

      if (res.success) setStep(3);
      else alert(res.error || t('suggest_submission_error')); 
    } catch (e) { 
      console.error("Submission Error:", e);
      alert(t('suggest_connection_error')); 
    } 
    finally { setLoading(false); }
  };

  const inputClass = "w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-4 rounded-xl border border-slate-300 dark:border-slate-600 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2 ml-1";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors">
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
                  <i className="fa-solid fa-pen-nib"></i>
              </div>
              <div>
                  <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">{t('suggest_title')}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('suggest_subtitle')}</p>
              </div>
          </div>
          <button onClick={handleGoHome} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-6 pb-32">
        
        {step === 1 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                  <label className={labelClass}>{t('suggest_name')} *</label>
                  <input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. El Chinchorro de Juana" autoFocus />
              </div>
              
              <div>
                  <label className={labelClass}>{t('suggest_category')}</label>
                  <div className="relative">
                      <select className={inputClass} value={category} onChange={e => setCategory(e.target.value as PlaceCategory)}>
                          {Object.values(PlaceCategory).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <i className="fa-solid fa-chevron-down"></i>
                      </div>
                  </div>
              </div>

              <div>
                  <label className={labelClass}>{t('suggest_gmaps')}</label>
                  <input className={inputClass} value={gmapsUrl} onChange={e => setGmapsUrl(e.target.value)} placeholder={t('admin_maps_link_placeholder')} />
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">Ayuda a encontrar la ubicación exacta.</p>
              </div>

              <div>
                  <label className={labelClass}>{t('suggest_photo')}</label>
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl p-8 text-center cursor-pointer hover:border-teal-500 dark:hover:border-teal-500 transition-colors group">
                      {imageFile ? (
                          <div className="flex flex-col items-center">
                              <i className="fa-solid fa-check-circle text-teal-500 text-3xl mb-2"></i>
                              <span className="text-teal-600 dark:text-teal-400 font-bold">{imageFile.name}</span>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center text-slate-400 group-hover:text-teal-500 transition-colors">
                              <i className="fa-solid fa-camera text-3xl mb-2"></i>
                              <span className="font-medium">{t('suggest_upload_photo')}</span>
                          </div>
                      )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
              </div>

              <div className="pt-4">
                  <Button label={t('next')} onClick={() => setStep(2)} />
              </div>
            </div>
        )}

        {step === 2 && (
            <div className="space-y-6 animate-slide-up">
              <div>
                  <label className={labelClass}>{t('suggest_desc')}</label>
                  <textarea className={`${inputClass} h-32 resize-none`} value={description} onChange={e => setDescription(e.target.value)} placeholder="¿Qué hace especial a este lugar?" />
              </div>
              
              <div>
                  <label className={labelClass}>{t('hours')}</label>
                  <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-300 dark:border-slate-600 flex mb-3">
                      {[
                          { id: 'fixed', label: t('sched_fixed') },
                          { id: '24_7', label: t('sched_24_7') },
                          { id: 'sunrise_sunset', label: t('sched_nature') }
                      ].map(opt => (
                          <button 
                              key={opt.id}
                              onClick={() => setHoursType(opt.id as any)}
                              className={`flex-1 py-2.5 text-[11px] font-bold uppercase rounded-lg transition-all ${hoursType === opt.id ? 'bg-teal-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                          >
                              {opt.label}
                          </button>
                      ))}
                  </div>
                  {hoursType === 'fixed' && (
                      <input className={inputClass} value={hoursNote} onChange={e => setHoursNote(e.target.value)} placeholder={t('suggest_hours_placeholder')} />
                  )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div><label className={labelClass}>{t('suggest_phone')}</label><input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} type="tel" /></div>
                <div><label className={labelClass}>{t('suggest_web')}</label><input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} type="url" /></div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-300 dark:border-slate-600 space-y-4">
                <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t('suggest_parking')}</span>
                    <input type="checkbox" checked={parking === ParkingStatus.FREE} onChange={e => setParking(e.target.checked ? ParkingStatus.FREE : ParkingStatus.PAID)} className="w-6 h-6 accent-teal-600 rounded cursor-pointer" />
                </div>
                <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t('suggest_restroom')}</span>
                    <input type="checkbox" checked={hasRestroom} onChange={e => setHasRestroom(e.target.checked)} className="w-6 h-6 accent-teal-600 rounded cursor-pointer" />
                </div>
                <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{t('suggest_pet')}</span>
                    <input type="checkbox" checked={isPetFriendly} onChange={e => setIsPetFriendly(e.target.checked)} className="w-6 h-6 accent-teal-600 rounded cursor-pointer" />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep(1)} className="px-6 py-4 rounded-xl text-slate-500 dark:text-slate-400 font-bold bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">{t('back')}</button>
                <div className="flex-1">
                    <Button 
                        label={analyzing || resolvingCoords ? t('suggest_analyzing_el_veci') : loading ? t('loading') : t('suggest_btn')} 
                        onClick={handleSubmit} 
                        disabled={loading || analyzing || resolvingCoords} 
                        icon={analyzing || resolvingCoords ? "circle-notch fa-spin" : "paper-plane"}
                    />
                </div>
              </div>
            </div>
        )}

        {step === 3 && (
            <div className="text-center py-12 animate-fade-in">
                <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg shadow-emerald-500/20">
                    <i className="fa-solid fa-check"></i>
                </div>
                <h3 className="text-3xl font-black text-slate-900 dark:text-white mb-4">{t('suggest_success_title')}</h3>
                <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed max-w-md mx-auto">{t('suggest_success_msg_admin_review')}</p>
                
                <div className="mt-12 space-y-3">
                    <Button label={t('admin_add_new_place')} onClick={() => window.location.reload()} variant="secondary" />
                    <button onClick={handleGoHome} className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-white transition-colors">
                        Ir al Mapa
                    </button>
                </div>
            </div>
        )}

      </main>
    </div>
  );
};

export default SuggestPage;
