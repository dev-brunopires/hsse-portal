import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, ClipboardList, Package, QrCode, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QRCodeScannerDialog } from '@/components/equipment/QRCodeScannerDialog';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const leftNavItems: NavItem[] = [
  { icon: User, label: 'Perfil', path: '/profile' },
  { icon: ClipboardList, label: 'Inspeções', path: '/inspections' },
];

const rightNavItems: NavItem[] = [
  { icon: Package, label: 'Equip.', path: '/equipment' },
  { icon: Bell, label: 'Alertas', path: '/alerts' },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const handleScan = (equipmentId: string) => {
    setScannerOpen(false);
    navigate(`/equipment?scan=${equipmentId}`);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
        {/* Background with curved notch */}
        <div className="relative">
          {/* Main bar background */}
          <div className="bg-card border-t border-border shadow-lg">
            <div className="flex items-center justify-around h-16 px-2">
              {/* Left items */}
              {leftNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                    isActive(item.path) 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive(item.path) && "stroke-[2.5]"
                  )} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}

              {/* Center spacer for FAB */}
              <div className="w-16" />

              {/* Right items */}
              {rightNavItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                    isActive(item.path) 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn(
                    "h-5 w-5",
                    isActive(item.path) && "stroke-[2.5]"
                  )} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Floating Action Button for QR Scanner */}
          <button
            onClick={() => setScannerOpen(true)}
            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 border-4 border-background"
          >
            <QrCode className="h-6 w-6 text-primary-foreground" />
          </button>
        </div>

        {/* Safe area padding for devices with home indicator */}
        <div className="bg-card h-safe-area-inset-bottom" />
      </nav>

      <QRCodeScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
