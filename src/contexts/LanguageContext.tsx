import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

type Language = 'pt-BR' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>('pt-BR');
  const [isLoading, setIsLoading] = useState(true);

  // Load language from user profile or localStorage
  useEffect(() => {
    const loadLanguage = async () => {
      setIsLoading(true);
      
      try {
        if (user) {
          // Try to get language from user profile
          const { data, error } = await supabase
            .from('profiles')
            .select('language')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!error && data?.language) {
            const lang = data.language as Language;
            setLanguageState(lang);
            i18n.changeLanguage(lang);
            localStorage.setItem('language', lang);
          } else {
            // Fallback to localStorage
            const storedLang = localStorage.getItem('language') as Language;
            if (storedLang && ['pt-BR', 'en'].includes(storedLang)) {
              setLanguageState(storedLang);
              i18n.changeLanguage(storedLang);
            }
          }
        } else {
          // No user, use localStorage
          const storedLang = localStorage.getItem('language') as Language;
          if (storedLang && ['pt-BR', 'en'].includes(storedLang)) {
            setLanguageState(storedLang);
            i18n.changeLanguage(storedLang);
          }
        }
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLanguage();
  }, [user, i18n]);

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('language', lang);

      // Save to profile if user is logged in
      if (user) {
        await supabase
          .from('profiles')
          .update({ language: lang })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error setting language:', error);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
