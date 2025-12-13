
import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const AboutPage: React.FC = () => {
  const { t } = useLanguage();

  const handleGoHome = () => {
      window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 font-sans transition-colors">
      
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-700 px-4 py-4 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-teal-600/20">
                  <i className="fa-solid fa-map-location-dot"></i>
              </div>
              <div>
                  <h1 className="text-lg font-black text-slate-900 dark:text-white leading-none">{t('about_title')}</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t('about_subtitle')}</p>
              </div>
          </div>
          <button onClick={handleGoHome} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors">
              <i className="fa-solid fa-xmark text-lg"></i>
          </button>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto p-6 pb-32 space-y-8 animate-slide-up">
        
        {/* El Veci Card */}
        <section className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <i className="fa-solid fa-user-astronaut text-8xl text-teal-600 dark:text-teal-400"></i>
            </div>
            <div className="relative z-10">
                <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full flex items-center justify-center text-3xl mb-4 shadow-sm">
                    <i className="fa-solid fa-robot"></i>
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{t('about_el_veci_title')}</h2>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t('about_el_veci_desc')}
                </p>
                <div className="mt-4 flex gap-2">
                    <span className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-3 py-1 rounded-full text-xs font-bold border border-teal-100 dark:border-teal-800">105-Year Rule</span>
                    <span className="bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-3 py-1 rounded-full text-xs font-bold border border-teal-100 dark:border-teal-800">Boricua Sano</span>
                </div>
            </div>
        </section>

        {/* Mission */}
        <section className="space-y-4">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <i className="fa-solid fa-bullseye text-purple-500"></i> {t('about_mission_title')}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {t('about_mission_desc')}
            </p>
        </section>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 dark:bg-amber-900/20 p-5 rounded-2xl border border-amber-100 dark:border-amber-800">
                <i className="fa-solid fa-wifi text-2xl text-amber-500 mb-2"></i>
                <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-1">{t('about_signal_saver')}</h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 leading-relaxed">{t('about_signal_saver_desc')}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-2xl border border-blue-100 dark:border-blue-800">
                <i className="fa-solid fa-shield-halved text-2xl text-blue-500 mb-2"></i>
                <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">{t('about_privacy')}</h4>
                <p className="text-xs text-blue-800 dark:text-blue-300/80 leading-relaxed">{t('about_privacy_desc')}</p>
            </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-slate-200 dark:border-slate-800">
            <p className="text-slate-400 dark:text-slate-600 text-sm font-bold uppercase tracking-widest mb-4">{t('about_community_built')}</p>
            <div className="flex justify-center gap-4 text-2xl text-slate-300 dark:text-slate-600">
                <i className="fa-solid fa-heart"></i>
                <i className="fa-solid fa-code"></i>
                <i className="fa-solid fa-map"></i>
            </div>
            <p className="mt-4 text-[10px] text-slate-400 font-mono">v2.0.0 • Cabo Rojo, PR</p>
        </div>

      </main>
    </div>
  );
};

export default AboutPage;
