import { useState, forwardRef } from 'react';
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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  History,
  Wrench,
  Building2,
  Award,
  Activity,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { SystemLogo } from '@/components/ui/SystemLogo';
import { prefetchRouteChunk } from '@/utils/routeChunkPrefetch';
import { useAccess } from '@/hooks/useAccess';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(
  ({ to, icon, label, collapsed }, ref) => {
    const location = useLocation();
    const isActive = location.pathname === to;

    const handlePrefetch = () => prefetchRouteChunk(to);

    return (
      <NavLink
        to={to}
        ref={ref}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
        onTouchStart={handlePrefetch}
      >
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
            'hover:bg-sidebar-accent text-sidebar-foreground',
            isActive && 'bg-sidebar-primary/20 text-sidebar-primary font-medium border-l-2 border-sidebar-primary',
            collapsed && 'justify-center px-2'
          )}
        >
          <span className={cn(
            'flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
            isActive && 'text-sidebar-primary'
          )}>
            {icon}
          </span>
          {!collapsed && (
            <span className="text-sm truncate">{label}</span>
          )}
        </div>
      </NavLink>
    );
  }
);

NavItem.displayName = 'NavItem';

interface NavGroupProps {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function NavGroup({ label, collapsed, children, defaultOpen = true }: NavGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (collapsed) {
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-200', !open && '-rotate-90')}
        />
      </button>
      {open && <div className="space-y-1">{children}</div>}
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isPlatformOwner } = useAuth();
  const access = useAccess();
  const { t } = useTranslation();
  const can = access.can;

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-72'
      )}
    >
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border px-4',
        collapsed && 'justify-center px-2'
      )}>
        <SystemLogo variant="white" showText={!collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        <NavGroup label={t('navigation.groupEquipment')} collapsed={collapsed}>
          {can('equipment', 'dashboard') && <div data-tour="dashboard"><NavItem to="/" icon={<LayoutDashboard size={20} />} label={t('navigation.dashboard')} collapsed={collapsed} /></div>}
          {can('equipment', 'equipment') && <div data-tour="equipment"><NavItem to="/equipment" icon={<Package size={20} />} label={t('navigation.equipment')} collapsed={collapsed} /></div>}
          {can('equipment', 'inspections') && <div data-tour="inspections"><NavItem to="/inspections" icon={<ClipboardCheck size={20} />} label={t('navigation.inspections')} collapsed={collapsed} /></div>}
          {can('equipment', 'maintenance') && <div data-tour="maintenance"><NavItem to="/maintenance" icon={<Wrench size={20} />} label={t('navigation.maintenance')} collapsed={collapsed} /></div>}
          {can('equipment', 'certificates') && <div data-tour="certificates"><NavItem to="/certificates" icon={<Award size={20} />} label={t('navigation.certificates')} collapsed={collapsed} /></div>}
          {can('equipment', 'pending') && <div data-tour="pending-recommendations"><NavItem to="/pending" icon={<AlertCircle size={20} />} label={t('navigation.pendingRecommendations')} collapsed={collapsed} /></div>}
          {can('reports', 'reports') && <div data-tour="reports"><NavItem to="/reports" icon={<FileText size={20} />} label={t('navigation.reports')} collapsed={collapsed} /></div>}
          {can('alerts', 'alerts') && <div data-tour="alerts"><NavItem to="/alerts" icon={<Bell size={20} />} label={t('navigation.alerts')} collapsed={collapsed} /></div>}
          {can('equipment', 'categories') && <div data-tour="categories"><NavItem to="/categories" icon={<FolderOpen size={20} />} label={t('navigation.categories')} collapsed={collapsed} /></div>}
          {can('equipment', 'supervisor') && <div data-tour="supervisor"><NavItem to="/supervisor" icon={<Users size={20} />} label={t('navigation.supervisor')} collapsed={collapsed} /></div>}
        </NavGroup>

        {access.canViewModule('health') && (
          <NavGroup label={t('navigation.groupHealth')} collapsed={collapsed}>
            {can('health', 'heat_stress') && <div data-tour="heat-stress"><NavItem to="/heat-stress" icon={<Thermometer size={20} />} label={t('navigation.heatStress')} collapsed={collapsed} /></div>}
          </NavGroup>
        )}

        {access.canViewModule('obs_cards') && (
          <NavGroup label={t('navigation.groupSafety')} collapsed={collapsed}>
            {can('obs_cards', 'dashboard') && <div data-tour="obs-cards"><NavItem to="/obs-cards" icon={<ShieldAlert size={20} />} label={t('navigation.obsCardsAi')} collapsed={collapsed} /></div>}
            {can('obs_cards', 'safety_observation') && <div data-tour="safety-observation"><NavItem to="/obs-cards/safety-observation" icon={<ClipboardList size={20} />} label={t('navigation.safetyObservation')} collapsed={collapsed} /></div>}
            {can('obs_cards', 'reports') && <div data-tour="safety-observation-reports"><NavItem to="/obs-cards/reports" icon={<FileText size={20} />} label={t('navigation.safetyObservationReports')} collapsed={collapsed} /></div>}
          </NavGroup>
        )}

        {access.canViewModule('evv') && (
          <NavGroup label={t('navigation.groupVV')} collapsed={collapsed}>
            {can('evv', 'home') && <NavItem to="/evv" icon={<ShieldCheck size={20} />} label={t('navigation.evvHome')} collapsed={collapsed} />}
            {can('evv', 'forms') && <NavItem to="/evv/forms" icon={<ClipboardCheck size={20} />} label={t('navigation.evvForms')} collapsed={collapsed} />}
            {can('evv', 'history') && <NavItem to="/evv/history" icon={<History size={20} />} label={t('navigation.evvHistory')} collapsed={collapsed} />}
            {can('evv', 'review', 'approve') && <NavItem to="/evv/review" icon={<ShieldCheck size={20} />} label={t('navigation.evvReview')} collapsed={collapsed} />}
            {can('evv', 'reports') && <NavItem to="/evv/reports" icon={<FileText size={20} />} label={t('navigation.evvReports')} collapsed={collapsed} />}
          </NavGroup>
        )}
      </nav>


      {/* Bottom Section - Admin only items */}
      {(can('admin', 'users') || can('audit', 'audit_log')) && (
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {can('admin', 'users') && <div data-tour="users"><NavItem to="/users" icon={<Users size={20} />} label={t('navigation.users')} collapsed={collapsed} /></div>}
          {can('audit', 'audit_log') && <div data-tour="audit-log"><NavItem to="/audit-log" icon={<History size={20} />} label={t('navigation.auditLog')} collapsed={collapsed} /></div>}
        </div>
      )}
      {(can('health', 'health_check') || isPlatformOwner) && (
        <div className={!(can('admin', 'users') || can('audit', 'audit_log')) ? "border-t border-sidebar-border p-3 space-y-1" : "px-3 pb-3 space-y-1"}>
          {can('health', 'health_check') && <div data-tour="health-check"><NavItem to="/health-check" icon={<Activity size={20} />} label={t('navigation.healthCheck')} collapsed={collapsed} /></div>}
          {isPlatformOwner && (
            <NavItem to="/platform-admin" icon={<Building2 size={20} />} label={t('navigation.platformAdmin')} collapsed={collapsed} />
          )}
        </div>
      )}

      {/* Collapse Button */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent',
            collapsed && 'px-2'
          )}
        >
          {collapsed ? <ChevronRight size={18} /> : (
            <span className="flex items-center gap-2">
              <ChevronLeft size={18} />
              <span className="text-sm">{t('navigation.collapse')}</span>
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}
