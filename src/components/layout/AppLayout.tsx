import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { AppSidebar } from './AppSidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Header } from './Header';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { Loader2, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Unified Header for both mobile and desktop */}
        <Header 
          showMenuButton={true} 
          onMenuClick={() => setMobileMenuOpen(true)} 
        />

        <main className="flex-1 overflow-auto p-4 lg:p-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      <OfflineIndicator />
      <PWAInstallPrompt />
    </div>
  );
}
