import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SupportedLanguage } from '../types';
import { translations, SUPPORTED_LANGUAGES, getTranslation } from '../i18n/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, fallback?: string) => string;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'tendo_language_preference';

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (SUPPORTED_LANGUAGES.some(l => l.code === saved))) {
        return saved as SupportedLanguage;
      }
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }
    return 'en';
  });

  const setLanguage = (newLang: SupportedLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch (e) {
      // Ignore
    }
  }, [language]);

  const t = (key: string, fallback?: string): string => {
    return getTranslation(language, key, fallback);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, supportedLanguages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside of provider
    return {
      language: 'en',
      setLanguage: () => {},
      t: (key: string, fallback?: string) => getTranslation('en', key, fallback),
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return context;
};
