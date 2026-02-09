import React, { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type Language = 'pt-BR' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('language') as Language;
    return stored && ['pt-BR', 'en'].includes(stored) ? stored : 'pt-BR';
  });
  const [isLoading, setIsLoading] = useState(true);

  // Apply initial language immediately from localStorage (no async wait)
  useEffect(() => {
    i18n.changeLanguage(language);
  }, []);

  // Load language from profile when user is available
  useEffect(() => {
    if (authLoading) return;

    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadFromProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!cancelled && !error && data?.language) {
          const lang = data.language as Language;
          setLanguageState(lang);
          i18n.changeLanguage(lang);
          localStorage.setItem('language', lang);
        }
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadFromProfile();
    return () => { cancelled = true; };
  }, [user?.id, authLoading, i18n]);

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('language', lang);

      if (user?.id) {
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
