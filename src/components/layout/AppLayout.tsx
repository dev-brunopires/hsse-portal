import { Suspense, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { Header } from './Header';
import { OfflineIndicator } from './OfflineIndicator';
import { PWAInstallPrompt } from './PWAInstallPrompt';
import { PageTransition } from '@/components/ui/PageTransition';
import { PageLoadingFallback } from '@/components/ui/PageLoadingFallback';
import { PWAUpdatePrompt } from './PWAUpdatePrompt';
import { SyncProgressIndicator } from './SyncProgressIndicator';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';
import { prefetchRouteChunk } from '@/utils/routeChunkPrefetch';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const equipmentRoutes = [
    '/equipment-dashboard',
    '/equipment',
    '/inspections',
    '/maintenance',
    '/certificates',
    '/pending',
    '/categories',
    '/supervisor',
    '/reports',
    '/alerts',
  ];
  const showMobileBottomNav = equipmentRoutes.some((path) => (
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  ));
  
  // Enable global keyboard shortcuts
  useKeyboardShortcuts();
  // Prefetch common queries (equipment, categories, ships) once auth/ship is ready
  useRoutePrefetch();

  // Pre-warm all lazy route chunks during browser idle time so subsequent
  // navigations skip the dynamic-import wait entirely.
  useEffect(() => {
    const paths = [
      '/', '/equipment-dashboard', '/equipment', '/inspections', '/maintenance', '/certificates',
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
    <div className="flex h-dvh bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Mobile Sidebar */}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />

      <div className="flex-1 flex min-w-0 flex-col overflow-hidden">
        {/* Unified Header for both mobile and desktop */}
        <Header 
          showMenuButton={true} 
          onMenuClick={() => setMobileMenuOpen(true)} 
        />

        <main
          className={cn(
            'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 lg:p-6 lg:pb-6 [scrollbar-gutter:stable]',
            showMobileBottomNav && 'pwa-main-content',
          )}
        >
          <Suspense fallback={<PageLoadingFallback delay={120} />}>
            <PageTransition>
              {children}
            </PageTransition>
          </Suspense>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {showMobileBottomNav && <MobileBottomNav />}

      {/* System Indicators */}
      <OfflineIndicator />
      <PWAInstallPrompt />
      <PWAUpdatePrompt />
      <SyncProgressIndicator />
    </div>
  );
}
