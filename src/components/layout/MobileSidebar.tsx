import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileText,
  Users,
  Bell,
  FolderOpen,
  AlertCircle,
  Building2,
  History,
  Wrench,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { SystemLogo } from '@/components/ui/SystemLogo';

interface MobileNavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const MobileNavItem = ({ to, icon, label, onClick }: MobileNavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink to={to} onClick={onClick}>
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent text-sidebar-foreground',
          isActive && 'bg-sidebar-primary/20 text-sidebar-primary font-medium border-l-2 border-sidebar-primary'
        )}
      >
        <span className={cn('flex-shrink-0', isActive && 'text-sidebar-primary')}>
          {icon}
        </span>
        <span className="text-sm">{label}</span>
      </div>
    </NavLink>
  );
};

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { t } = useTranslation();
  const { isAdmin, isPlatformOwner } = useAuth();

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-72 p-0 bg-sidebar border-sidebar-border flex flex-col h-full"
      >
        <SheetHeader className="h-16 flex flex-row items-center justify-between border-b border-sidebar-border px-4 pt-safe shrink-0">
          <SystemLogo variant="white" />
        </SheetHeader>

        {/* Navigation - Main items only */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <MobileNavItem to="/" icon={<LayoutDashboard size={20} />} label={t('navigation.dashboard')} onClick={handleNavClick} />
          <MobileNavItem to="/equipment" icon={<Package size={20} />} label={t('navigation.equipment')} onClick={handleNavClick} />
          <MobileNavItem to="/inspections" icon={<ClipboardCheck size={20} />} label={t('navigation.inspections')} onClick={handleNavClick} />
          <MobileNavItem to="/maintenance" icon={<Wrench size={20} />} label={t('navigation.maintenance')} onClick={handleNavClick} />
          <MobileNavItem to="/certificates" icon={<Award size={20} />} label={t('navigation.certificates')} onClick={handleNavClick} />
          <MobileNavItem to="/pending" icon={<AlertCircle size={20} />} label={t('navigation.pendingRecommendations')} onClick={handleNavClick} />
          <MobileNavItem to="/reports" icon={<FileText size={20} />} label={t('navigation.reports')} onClick={handleNavClick} />
          <MobileNavItem to="/alerts" icon={<Bell size={20} />} label={t('navigation.alerts')} onClick={handleNavClick} />
          <MobileNavItem to="/categories" icon={<FolderOpen size={20} />} label={t('navigation.categories')} onClick={handleNavClick} />
        </nav>

        {/* Admin Section - Only admin-specific items */}
        {(isAdmin || isPlatformOwner) && (
          <div className="border-t border-sidebar-border p-3 space-y-1 shrink-0 pb-safe">
            {isAdmin && (
              <>
                <MobileNavItem to="/users" icon={<Users size={20} />} label={t('navigation.users')} onClick={handleNavClick} />
                <MobileNavItem to="/audit-log" icon={<History size={20} />} label={t('navigation.auditLog')} onClick={handleNavClick} />
              </>
            )}
            {isPlatformOwner && (
              <MobileNavItem to="/platform-admin" icon={<Building2 size={20} />} label={t('navigation.platformAdmin')} onClick={handleNavClick} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}