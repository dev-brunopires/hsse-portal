import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText, ClipboardList, Package, QrCode, Bell, LayoutDashboard, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeScannerDialog } from '@/components/equipment/QRCodeScannerDialog';
import { hapticButton, hapticSuccess } from '@/utils/hapticFeedback';

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  tabletOnly?: boolean;
}

const leftNavItems: NavItem[] = [
  { icon: LayoutDashboard, labelKey: 'navigation.dashboard', path: '/', tabletOnly: true },
  { icon: FileText, labelKey: 'navigation.reports', path: '/reports' },
  { icon: ClipboardList, labelKey: 'navigation.inspections', path: '/inspections' },
];

const rightNavItems: NavItem[] = [
  { icon: Package, labelKey: 'common.equipment', path: '/equipment' },
  { icon: Wrench, labelKey: 'navigation.maintenance', path: '/maintenance', tabletOnly: true },
  { icon: Bell, labelKey: 'navigation.alerts', path: '/alerts' },
];

export function MobileBottomNav() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleNavigation = (path: string) => {
    hapticButton();
    navigate(path);
  };

  const handleScan = (equipmentId: string) => {
    setScannerOpen(false);
    hapticSuccess();
    navigate(`/inspections?scan=${equipmentId}`);
  };

  const handleOpenScanner = () => {
    hapticButton();
    setScannerOpen(true);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Background with curved notch */}
        <div className="relative">
          {/* Main bar background */}
          <div className="bg-card border-t border-border shadow-lg">
            <div className="flex items-center justify-around h-16 px-2 pb-safe">
              {/* Left items */}
              {leftNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] min-h-[48px] touch-manipulation active:scale-95",
                    isActive(item.path) 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground active:text-foreground",
                    item.tabletOnly && "hidden sm:flex"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive(item.path) && "stroke-[2.5]"
                  )} />
                  <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
                </button>
              ))}

              {/* Center spacer for FAB */}
              <div className="w-16" />

              {/* Right items */}
              {rightNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigation(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px] min-h-[48px] touch-manipulation active:scale-95",
                    isActive(item.path) 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground active:text-foreground",
                    item.tabletOnly && "hidden sm:flex"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive(item.path) && "stroke-[2.5]"
                  )} />
                  <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Floating Action Button for QR Scanner - Centered */}
          <button
            onClick={handleOpenScanner}
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 border-4 border-background touch-manipulation"
            aria-label={t('equipment.scanQRCode')}
          >
            <QrCode className="h-6 w-6 text-primary-foreground" />
          </button>
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="bg-card h-safe" />
      </nav>

      <QRCodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
