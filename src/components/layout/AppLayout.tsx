import { useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Header } from './Header';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';
import { SyncProgressIndicator } from './SyncProgressIndicator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();

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

        <main className="flex-1 overflow-auto p-4 lg:p-6 pwa-main-content lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* System Indicators */}
      <OfflineIndicator />
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <SyncProgressIndicator />
    </div>
  );
}
