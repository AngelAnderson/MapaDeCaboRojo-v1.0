
import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from './translations';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  // Updated t function to accept an optional options object for interpolation
  t: (key: keyof typeof translations['es'], options?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    const saved = localStorage.getItem('app_language') as Language;
    if (saved && (saved === 'es' || saved === 'en')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app_language', lang);
  };

  // Updated t function implementation to handle interpolation
  const t = (key: keyof typeof translations['es'], options?: Record<string, string | number>) => {
    let text = translations[language][key] || key;
    if (options) {
      for (const optKey in options) {
        // Use a global regex for all occurrences
        text = text.replace(new RegExp(`{{${optKey}}}`, 'g'), String(options[optKey]));
      }
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
    