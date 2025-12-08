
import React, { useState, useRef } from 'react';
import { createPlace, uploadImage } from '../services/supabase';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<PlaceCategory>(PlaceCategory.FOOD);
  const [gmapsUrl, setGmapsUrl] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [tips, setTips] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [parking, setParking] = useState<ParkingStatus>(ParkingStatus.FREE);
  const [hasRestroom, setHasRestroom] = useState(false);
  const [isPetFriendly, setIsPetFriendly] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) return alert("El nombre es obligatorio");
    setLoading(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        const up = await uploadImage(imageFile);
        if (up.success && up.url) imageUrl = up.url;
      }
      const res = await createPlace({
        name, category, gmapsUrl, address, description, tips, imageUrl, phone, website, parking, hasRestroom, isPetFriendly,
        status: 'open', coords: { lat: 17.9620, lng: -67.1650 }, is_featured: false, sponsor_weight: 0, isVerified: false
      });
      if (res.success) setStep(3);
      else alert("Error: " + res.error);
    } catch (e) { alert("Error de conexión"); } 
    finally { setLoading(false); }
  };

  const inputClass = "w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 outline-none focus:border-teal-500 transition-colors";
  const labelClass = "block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1";

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[2500] flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh] transition-colors">
        <div className="bg-teal-600 dark:bg-teal-700 p-6 text-white flex justify-between items-center shrink-0 shadow-md z-10">
          <div><h2 className="text-2xl font-black">{t('suggest_title')}</h2><p className="text-teal-100 text-sm">{t('suggest_subtitle')}</p></div>
          <button onClick={onClose} className="bg-teal-700/50 p-2 rounded-full hover:bg-teal-800 transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
          {step === 1 && (
            <div className="space-y-4 animate-slide-up">
              <div><label className={labelClass}>{t('suggest_name')} *</label><input className={inputClass} value={name} onChange={e => setName(e.target.value)} placeholder="Ej. El Chinchorro de Juana" /></div>
              <div><label className={labelClass}>{t('suggest_category')}</label><select className={inputClass} value={category} onChange={e => setCategory(e.target.value as PlaceCategory)}>{Object.values(PlaceCategory).map(c => <option key={c} value={c} className="text-slate-900 bg-white">{c}</option>)}</select></div>
              <div><label className={labelClass}>{t('suggest_gmaps')}</label><input className={inputClass} value={gmapsUrl} onChange={e => setGmapsUrl(e.target.value)} placeholder="Pega el link aquí" /></div>
              <div><label className={labelClass}>{t('suggest_photo')}</label><div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">{imageFile ? <span className="text-teal-600 dark:text-teal-400 font-bold">{imageFile.name}</span> : <span className="text-slate-400 dark:text-slate-500"><i className="fa-solid fa-camera mr-2"></i> Subir Foto</span>}</div><input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} /></div>
              <Button label={t('next')} onClick={() => setStep(2)} />
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 animate-slide-up">
              <div><label className={labelClass}>{t('suggest_desc')}</label><textarea className={`${inputClass} h-24`} value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelClass}>{t('suggest_phone')}</label><input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div><label className={labelClass}>{t('suggest_web')}</label><input className={inputClass} value={website} onChange={e => setWebsite(e.target.value)} /></div>
              </div>
              <div className="space-y-2 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_parking')}</span><input type="checkbox" checked={parking === ParkingStatus.FREE} onChange={e => setParking(e.target.checked ? ParkingStatus.FREE : ParkingStatus.PAID)} className="w-5 h-5 accent-teal-600 rounded" /></div>
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_restroom')}</span><input type="checkbox" checked={hasRestroom} onChange={e => setHasRestroom(e.target.checked)} className="w-5 h-5 accent-teal-600 rounded" /></div>
                <div className="flex justify-between items-center"><span className="text-sm font-medium">{t('suggest_pet')}</span><input type="checkbox" checked={isPetFriendly} onChange={e => setIsPetFriendly(e.target.checked)} className="w-5 h-5 accent-teal-600 rounded" /></div>
              </div>
              <div className="flex gap-2"><button onClick={() => setStep(1)} className="p-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-700 dark:hover:text-slate-200 transition-colors">{t('back')}</button><Button label={loading ? t('loading') : t('suggest_btn')} onClick={handleSubmit} disabled={loading} /></div>
            </div>
          )}
          {step === 3 && (
            <div className="text-center py-10 animate-fade-in"><div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-sm"><i className="fa-solid fa-check"></i></div><h3 className="text-2xl font-bold text-slate-800 dark:text-white">{t('suggest_success_title')}</h3><p className="text-slate-600 dark:text-slate-300 mt-2">{t('suggest_success_msg')}</p><button onClick={onClose} className="mt-8 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">{t('close')}</button></div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SuggestPlaceModal;
