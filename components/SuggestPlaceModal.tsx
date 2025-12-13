
import React, { useState, useRef } from 'react';
import { createPlace, uploadImage } from '../services/supabase';
import { moderateUserContent } from '../services/aiService'; 
import { findCoordinates } from '../services/placesService'; 
import { PlaceCategory, ParkingStatus } from '../types';
import Button from './Button';
import { useLanguage } from '../i18n/LanguageContext';

interface SuggestPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SuggestPlaceModal: React.FC<SuggestPlaceModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [analyzing, setAnalyzing] = useState(false); 
  const [resolvingCoords, setResolvingCoords] = useState(false); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>(PlaceCategory.FOOD);
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tips, setTips] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  
  // Hours State
  const [hoursType, setHoursType] = useState<'fixed' | '24_7' | 'sunrise_sunset'>('fixed');
  const [hoursNote, setHoursNote] = useState('');

  const [parking, setParking] = useState<ParkingStatus>(ParkingStatus.FREE);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);

  if (!isOpen) return null;

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

  const handleShareLink = () => {
      const url = `${window.location.origin}/?page=suggest`;
      navigator.clipboard.writeText(url);
      alert(t('link_copied'));
  };

  const handleOpenPage = () => {
      window.location.href = '/?page=suggest';
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
      let resolvedAddress = '';
      if (gmapsUrl.trim()) {
        setResolvingCoords(true);
        const coordsResult = await findCoordinates(gmapsUrl);
        if (coordsResult) {
          resolvedCoords = coordsResult;
        }
        setResolvingCoords(false);
      }
      
      const res = await createPlace({
        name, 
        category, 
        gmapsUrl, 
        address: resolvedAddress, 
        description, 
        tips, 
        imageUrl, 
        phone, 
        website, 
        parking, 
        hasRestroom, 
        isPetFriendly,
        status: 'pending', 
        coords: resolvedCoords, 
        is_featured: false, 
        sponsor_weight: 0, 
        isVerified: false,
        tags: ['User Suggestion', 'AI Verified'],
        opening_hours: {
            type: hoursType,
            note: hoursNote 
        }
      });

      if (res.success) setStep(3);
      else alert(res.error || t('suggest_submission_error')); 
    } catch (e) { 
      console.error("Submission Error:", e);
      alert(t('suggest_connection_error')); 
    } 
    finally { setLoading(false); }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-teal-500 transition-colors";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2500] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh] transition-colors">
        <div className="bg-teal-600 dark:bg-teal-700 p-6 text-white flex justify-between items-center shrink-0 shadow-md z-10">
          <div><h2 className="text-2xl font-black">{t('suggest_title')}</h2><p className="text-teal-100 text-sm">{t('suggest_subtitle')}</p></div>
          <div className="flex items-center gap-2">
              <button onClick={handleOpenPage} className="bg-teal-700/50 p-2 rounded-full hover:bg-teal-800 transition-colors" title="Open Full Page">
                  <i className="fa-solid fa-up-right-from-square text-lg"></i>
              </button>
              <button onClick={handleShareLink} className="bg-teal-700/50 p-2 rounded-full hover:bg-teal-800 transition-colors" title={t('share')}>
                  <i className="fa-solid fa-share-nodes text-lg"></i>
              </button>
              <button onClick={onClose} className="bg-teal-700/50 p-2 rounded-full hover:bg-teal-800 transition-colors">
                  <i className="fa-solid fa-xmark text-xl"></i>
              </button>
          </div>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
          {step === 1 && (
            <div className="space-y-4 animate-slide-up">
              <div><label className={labelClass}>{t('suggest_name')} *</label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. El Chinchorro de Juana" /></div>
              <div><label className={labelClass}>{t('suggest_category')}</label><select className={inputClass} value={category} onChange={e => setCategory(e.target.value as PlaceCategory)}>{Object.values(PlaceCategory).map(c => <option key={c} value={c} className="text-slate-900 bg-white">{c}</option>)}</select></div>
              <div><label className={labelClass}>{t('suggest_gmaps')}</label><input className={inputClass} value={gmapsUrl} onChange={e => setGmapsUrl(e.target.value)} placeholder={t('admin_maps_link_placeholder')} /></div>
              <div><label className={labelClass}>{t('suggest_photo')}</label><div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">{imageFile ? <span className="text-teal-600 dark:text-teal-400 font-bold">{imageFile.name}</span> : <span className="text-slate-400 dark:text-slate-500"><i className="fa-solid fa-camera mr-2"></i> {t('suggest_upload_photo')}</span>}</div><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} /></div>
              <Button label={t('next')} onClick={() => setStep(2)} />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-slide-up">
              <div><label className={labelClass}>{t('suggest_desc')}</label><textarea className={`${inputClass} h-24`} value={description} onChange={e => setDescription(e.target.value)} /></div>
              
              {/* Hours Section */}
              <div>
                  <label className={labelClass}>{t('hours')}</label>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex mb-2">
                      {[
                          { id: 'fixed', label: t('sched_fixed') },
                          { id: '24_7', label: t('sched_24_7') },
                          { id: 'sunrise_sunset', label: t('sched_nature') }
                      ].map(opt => (
                          <button 
                              key={opt.id}
                              onClick={() => setHoursType(opt.id as any)}
                              className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-colors ${hoursType === opt.id ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'}`}
                          >
                              {opt.label}
                          </button>
                      ))}
                  </div>
                  {hoursType === 'fixed' && (
                      <input 
                          className={inputClass} 
                          value={hoursNote} 
                          onChange={e => setHoursNote(e.target.value)} 
                          placeholder={t('suggest_hours_placeholder')} 
                      />
                  )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>{t('suggest_phone')}</label><input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div><label className={labelClass}>{t('suggest_web')}</label><input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} /></div>
              </div>
              <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_parking')}</span><input type="checkbox" checked={parking === ParkingStatus.FREE} onChange={e => setParking(e.target.checked ? ParkingStatus.FREE : ParkingStatus.PAID)} className="w-5 h-5 accent-teal-600 rounded" /></div>
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_restroom')}</span><input type="checkbox" checked={hasRestroom} onChange={e => setHasRestroom(e.target.checked)} className="w-5 h-5 accent-teal-600 rounded" /></div>
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_pet')}</span><input type="checkbox" checked={isPetFriendly} onChange={e => setIsPetFriendly(e.target.checked)} className="w-5 h-5 accent-teal-600 rounded" /></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="p-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors">{t('back')}</button>
                <Button 
                    label={analyzing || resolvingCoords ? t('suggest_analyzing_el_veci') : loading ? t('loading') : t('suggest_btn')} 
                    onClick={handleSubmit} 
                    disabled={loading || analyzing || resolvingCoords} 
                    icon={analyzing || resolvingCoords ? "circle-notch fa-spin" : undefined}
                />
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="text-center py-10 animate-fade-in"><div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm"><i className="fa-solid fa-check"></i></div><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{t('suggest_success_title')}</h3><p className="text-slate-600 dark:text-slate-300 mt-2">{t('suggest_success_msg_admin_review')}</p><button onClick={onClose} className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">{t('close')}</button></div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SuggestPlaceModal;
