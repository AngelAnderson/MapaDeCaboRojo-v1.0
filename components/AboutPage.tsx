
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

interface AboutPageProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutPage: React.FC<AboutPageProps> = ({ isOpen, onClose }) => {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] bg-slate-50 dark:bg-slate-900 flex flex-col font-sans transition-colors duration-300 animate-fade-in">
      
      {/* Admin-Style Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center shadow-sm z-20 shrink-0 h-16">
          <div className="flex items-center gap-3">
              <div className="bg-teal-600 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-teal-600/20 text-white">
                  <i className="fa-solid fa-circle-info text-sm"></i>
              </div>
              <div>
                <h1 className="font-black text-lg tracking-tight text-slate-900 dark:text-white leading-none">{t('about_title')}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{t('about_subtitle')}</p>
              </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-700 transition-colors"
            aria-label={t('close')}
          >
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto space-y-8 pb-12 animate-slide-up">
            
            {/* El Veci Card */}
            <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i className="fa-solid fa-user-astronaut text-9xl text-teal-600 dark:text-teal-400 transform rotate-12"></i>
                </div>
                <div className="relative z-10">
                    <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-2xl flex items-center justify-center text-3xl mb-6 shadow-sm">
                        <i className="fa-solid fa-robot"></i>
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-4">{t('about_el_veci_title')}</h2>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
                        {t('about_el_veci_desc')}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                        <span className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-4 py-1.5 rounded-full text-xs font-bold border border-teal-100 dark:border-teal-800 shadow-sm">105-Year Rule</span>
                        <span className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-4 py-1.5 rounded-full text-xs font-bold border border-teal-100 dark:border-teal-800 shadow-sm">Boricua Sano</span>
                    </div>
                </div>
            </section>

            {/* Mission */}
            <section className="space-y-4 px-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm">
                        <i className="fa-solid fa-bullseye"></i>
                    </div>
                    {t('about_mission_title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed pl-11">
                    {t('about_mission_desc')}
                </p>
            </section>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-2xl border border-amber-100 dark:border-amber-800/50 hover:border-amber-300 transition-colors">
                    <i className="fa-solid fa-wifi text-3xl text-amber-500 mb-4"></i>
                    <h4 className="font-bold text-lg text-amber-900 dark:text-amber-100 mb-2">{t('about_signal_saver')}</h4>
                    <p className="text-sm text-amber-800 dark:text-amber-300/80 leading-relaxed">{t('about_signal_saver_desc')}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800/50 hover:border-blue-300 transition-colors">
                    <i className="fa-solid fa-shield-halved text-3xl text-blue-500 mb-4"></i>
                    <h4 className="font-bold text-lg text-blue-900 dark:text-blue-100 mb-2">{t('about_privacy')}</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-300/80 leading-relaxed">{t('about_privacy_desc')}</p>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center pt-12 border-t border-slate-200 dark:border-slate-800">
                <p className="text-slate-400 dark:text-slate-600 text-xs font-bold uppercase tracking-widest mb-6">{t('about_community_built')}</p>
                <div className="flex justify-center gap-6 text-3xl text-slate-300 dark:text-slate-700">
                    <i className="fa-brands fa-react hover:text-blue-400 transition-colors"></i>
                    <i className="fa-brands fa-node-js hover:text-green-500 transition-colors"></i>
                    <i className="fa-solid fa-leaf hover:text-green-400 transition-colors"></i>
                </div>
                <p className="mt-6 text-[10px] text-slate-400 font-mono">v2.0.0 • Cabo Rojo, PR</p>
            </div>
        </div>
      </main>
    </div>
  );
};

export default AboutPage;
