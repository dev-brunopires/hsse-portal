import { useState } from 'react';
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
  ChevronDown,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  Activity,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { SystemLogo } from '@/components/ui/SystemLogo';
import { useAccess } from '@/hooks/useAccess';

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

function MobileNavGroup({ label, children, defaultOpen = true }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={14} className={cn('transition-transform', !open && '-rotate-90')} />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { t } = useTranslation();
  const { isPlatformOwner } = useAuth();
  const access = useAccess();
  const can = access.can;

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-72 p-0 bg-sidebar border-sidebar-border flex flex-col h-full"
      >
        <SheetHeader className="min-h-16 flex flex-row items-center justify-between border-b border-sidebar-border px-4 shrink-0 pwa-header">
          <SystemLogo variant="white" />
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          <MobileNavGroup label={t('navigation.groupEquipment')}>
            {can('equipment', 'dashboard') && <MobileNavItem to="/" icon={<LayoutDashboard size={20} />} label={t('navigation.dashboard')} onClick={handleNavClick} />}
            {can('equipment', 'equipment') && <MobileNavItem to="/equipment" icon={<Package size={20} />} label={t('navigation.equipment')} onClick={handleNavClick} />}
            {can('equipment', 'inspections') && <MobileNavItem to="/inspections" icon={<ClipboardCheck size={20} />} label={t('navigation.inspections')} onClick={handleNavClick} />}
            {can('equipment', 'maintenance') && <MobileNavItem to="/maintenance" icon={<Wrench size={20} />} label={t('navigation.maintenance')} onClick={handleNavClick} />}
            {can('equipment', 'certificates') && <MobileNavItem to="/certificates" icon={<Award size={20} />} label={t('navigation.certificates')} onClick={handleNavClick} />}
            {can('equipment', 'pending') && <MobileNavItem to="/pending" icon={<AlertCircle size={20} />} label={t('navigation.pendingRecommendations')} onClick={handleNavClick} />}
            {can('reports', 'reports') && <MobileNavItem to="/reports" icon={<FileText size={20} />} label={t('navigation.reports')} onClick={handleNavClick} />}
            {can('alerts', 'alerts') && <MobileNavItem to="/alerts" icon={<Bell size={20} />} label={t('navigation.alerts')} onClick={handleNavClick} />}
            {can('equipment', 'categories') && <MobileNavItem to="/categories" icon={<FolderOpen size={20} />} label={t('navigation.categories')} onClick={handleNavClick} />}
            {can('equipment', 'supervisor') && <MobileNavItem to="/supervisor" icon={<Users size={20} />} label={t('navigation.supervisor')} onClick={handleNavClick} />}
          </MobileNavGroup>

          {access.canViewModule('health') && (
            <MobileNavGroup label={t('navigation.groupHealth')}>
              {can('health', 'heat_stress') && <MobileNavItem to="/heat-stress" icon={<Thermometer size={20} />} label={t('navigation.heatStress')} onClick={handleNavClick} />}
            </MobileNavGroup>
          )}

          {access.canViewModule('obs_cards') && (
            <MobileNavGroup label={t('navigation.groupSafety')}>
              {can('obs_cards', 'dashboard') && <MobileNavItem to="/obs-cards" icon={<ShieldAlert size={20} />} label={t('navigation.obsCardsAi')} onClick={handleNavClick} />}
              {can('obs_cards', 'safety_observation') && <MobileNavItem to="/obs-cards/safety-observation" icon={<ClipboardList size={20} />} label={t('navigation.safetyObservation')} onClick={handleNavClick} />}
              {can('obs_cards', 'reports') && <MobileNavItem to="/obs-cards/reports" icon={<FileText size={20} />} label={t('navigation.safetyObservationReports')} onClick={handleNavClick} />}
            </MobileNavGroup>
          )}

          {access.canViewModule('evv') && (
            <MobileNavGroup label={t('navigation.groupVV')}>
              {can('evv', 'home') && <MobileNavItem to="/evv" icon={<ShieldCheck size={20} />} label={t('navigation.evvHome')} onClick={handleNavClick} />}
              {can('evv', 'forms') && <MobileNavItem to="/evv/forms" icon={<ClipboardCheck size={20} />} label={t('navigation.evvForms')} onClick={handleNavClick} />}
              {can('evv', 'history') && <MobileNavItem to="/evv/history" icon={<History size={20} />} label={t('navigation.evvHistory')} onClick={handleNavClick} />}
              {can('evv', 'review', 'approve') && <MobileNavItem to="/evv/review" icon={<ShieldCheck size={20} />} label={t('navigation.evvReview')} onClick={handleNavClick} />}
              {can('evv', 'reports') && <MobileNavItem to="/evv/reports" icon={<FileText size={20} />} label={t('navigation.evvReports')} onClick={handleNavClick} />}
            </MobileNavGroup>
          )}
        </nav>

        {/* Admin Section */}
        {(can('admin', 'users') || can('audit', 'audit_log') || can('health', 'health_check') || isPlatformOwner) && (
          <div className="border-t border-sidebar-border p-3 space-y-1 shrink-0 pb-safe">
            {can('admin', 'users') && <MobileNavItem to="/users" icon={<Users size={20} />} label={t('navigation.users')} onClick={handleNavClick} />}
            {can('audit', 'audit_log') && <MobileNavItem to="/audit-log" icon={<History size={20} />} label={t('navigation.auditLog')} onClick={handleNavClick} />}
            {can('health', 'health_check') && <MobileNavItem to="/health-check" icon={<Activity size={20} />} label={t('navigation.healthCheck')} onClick={handleNavClick} />}
            {isPlatformOwner && (
              <MobileNavItem to="/platform-admin" icon={<Building2 size={20} />} label={t('navigation.platformAdmin')} onClick={handleNavClick} />
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
