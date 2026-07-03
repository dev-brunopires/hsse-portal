import { useState, useEffect } from 'react';
import { AppSidebar } from './AppSidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Header } from './Header';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { PageTransition } from '@/components/ui/PageTransition';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';
import { SyncProgressIndicator } from './SyncProgressIndicator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';
import { prefetchRouteChunk } from '@/utils/routeChunkPrefetch';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();
  // Prefetch common queries (equipment, categories, ships) once auth/ship is ready
  useRoutePrefetch();

  // Pre-warm all lazy route chunks during browser idle time so subsequent
  // navigations skip the dynamic-import wait entirely.
  useEffect(() => {
    const paths = [
      '/', '/equipment', '/inspections', '/maintenance', '/certificates',
      '/reports', '/alerts', '/pending', '/categories', '/profile',
    ];
    const idle = (cb: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => number };
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(cb);
      } else {
        setTimeout(cb, 1500);
      }
    };
    idle(() => paths.forEach(prefetchRouteChunk));
  }, []);

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
          <PageTransition>
            {children}
          </PageTransition>
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
