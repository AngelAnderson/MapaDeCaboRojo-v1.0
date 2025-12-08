
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuggest: () => void; 
  onChat?: () => void; // Kept as optional prop to prevent TS breaking in App.tsx, but ignored in UI
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, onSuggest }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[2000] flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden relative z-10 animate-slide-up border border-white/20 dark:border-slate-700 transition-colors">
        
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 pb-4 text-center border-b border-slate-100 dark:border-slate-700">
          <div className="w-14 h-14 bg-white dark:bg-slate-800 rounded-full mx-auto flex items-center justify-center shadow-lg border border-slate-100 dark:border-slate-700 mb-3 text-2xl animate-float">
            🤝
          </div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">{t('contact_title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">{t('contact_subtitle')}</p>
        </div>

        <div className="p-4 space-y-3">
            
          {/* Action Grid */}
          <div className="grid grid-cols-2 gap-3">
              <button onClick={onSuggest} className="bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95">
                  <i className="fa-solid fa-map-location-dot text-2xl text-slate-700 dark:text-slate-200"></i>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">{t('btn_suggest')}</span>
              </button>
              
              <button onClick={() => window.open('mailto:angel@caborojo.com?subject=Report Bug', '_self')} className="bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-600 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95">
                  <i className="fa-solid fa-bug text-2xl text-slate-700 dark:text-slate-200"></i>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 text-center">{t('report_issue')}</span>
              </button>
          </div>

          {/* Business Card */}
          <button onClick={() => window.open('https://wa.me/17874178228?text=Hola, tengo un negocio y quiero verificarlo.', '_blank')} className="w-full bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700/50 p-3 rounded-2xl flex items-center justify-between group active:scale-95 transition-transform">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 dark:bg-amber-800/30 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <i className="fa-solid fa-briefcase"></i>
                  </div>
                  <div className="text-left">
                      <h3 className="font-bold text-amber-900 dark:text-amber-400 text-sm">{t('contact_business_title')}</h3>
                      <p className="text-[10px] text-amber-700 dark:text-amber-500/80">{t('contact_business_action')}</p>
                  </div>
              </div>
          </button>

          {/* Socials Row */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 text-center">{t('contact_socials')}</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => window.open('https://instagram.com/caborojomap', '_blank')} className="w-10 h-10 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 dark:hover:bg-pink-900/40 text-pink-600 dark:text-pink-400 rounded-full flex items-center justify-center transition-colors active:scale-90"><i className="fa-brands fa-instagram text-lg"></i></button>
                <button onClick={() => window.open('https://wa.me/17874178228', '_blank')} className="w-10 h-10 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center transition-colors active:scale-90"><i className="fa-brands fa-whatsapp text-lg"></i></button>
                <button onClick={() => window.open('https://x.com/angelfanderson', '_blank')} className="w-10 h-10 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-white rounded-full flex items-center justify-center transition-colors active:scale-90"><i className="fa-brands fa-x-twitter text-lg"></i></button>
                <button onClick={() => window.open('mailto:angel@caborojo.com', '_self')} className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center transition-colors active:scale-90"><i className="fa-solid fa-envelope text-lg"></i></button>
            </div>
          </div>
        
          {/* Emergency Strip */}
          <button onClick={() => window.open('tel:911', '_self')} className="w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md shadow-red-500/20">
              <i className="fa-solid fa-phone-volume animate-pulse"></i>
              <span className="font-bold text-sm">{t('btn_emergency')}</span>
          </button>
        </div>

        <button onClick={onClose} className="w-full p-4 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm font-bold hover:text-slate-600 dark:hover:text-slate-300 transition-colors border-t border-slate-100 dark:border-slate-700">
            {t('close')}
        </button>
      </div>
    </div>
  );
};
export default ContactModal;
