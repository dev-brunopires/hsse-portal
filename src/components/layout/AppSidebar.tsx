import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ClipboardCheck,
  FileText,
  Settings,
  Users,
  Bell,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Shield,
  Flame,
  Wind,
  Gauge,
  ArrowUp,
  Waves,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}

const NavItem = ({ to, icon, label, collapsed }: NavItemProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink to={to}>
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
          'hover:bg-sidebar-accent text-sidebar-foreground',
          isActive && 'bg-sidebar-accent text-sidebar-primary font-medium',
          collapsed && 'justify-center px-2'
        )}
      >
        <span className={cn('flex-shrink-0', isActive && 'text-sidebar-primary')}>
          {icon}
        </span>
        {!collapsed && (
          <span className="text-sm truncate">{label}</span>
        )}
      </div>
    </NavLink>
  );
};

const CategoryItem = ({ icon, label, count, collapsed }: { icon: React.ReactNode; label: string; count: number; collapsed: boolean }) => (
  <div
    className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
      'hover:bg-sidebar-accent/50 text-sidebar-foreground/80 cursor-pointer',
      collapsed && 'justify-center px-2'
    )}
  >
    <span className="flex-shrink-0 text-sidebar-foreground/60">{icon}</span>
    {!collapsed && (
      <>
        <span className="text-sm truncate flex-1">{label}</span>
        <span className="text-xs bg-sidebar-accent px-2 py-0.5 rounded-full">{count}</span>
      </>
    )}
  </div>
);

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border px-4',
        collapsed && 'justify-center px-2'
      )}>
        {collapsed ? (
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">SBM Offshore</span>
              <span className="text-xs text-sidebar-foreground/60">Safety Equipment</span>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={collapsed} />
        <NavItem to="/equipment" icon={<Package size={20} />} label="Equipamentos" collapsed={collapsed} />
        <NavItem to="/inspections" icon={<ClipboardCheck size={20} />} label="Inspeções" collapsed={collapsed} />
        <NavItem to="/reports" icon={<FileText size={20} />} label="Relatórios" collapsed={collapsed} />
        <NavItem to="/alerts" icon={<Bell size={20} />} label="Alertas" collapsed={collapsed} />

        {!collapsed && (
          <div className="pt-4">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/50">
              Categorias
            </p>
          </div>
        )}

        <CategoryItem icon={<Flame size={18} />} label="Extintores" count={3} collapsed={collapsed} />
        <CategoryItem icon={<Wind size={18} />} label="EEBD" count={1} collapsed={collapsed} />
        <CategoryItem icon={<Shield size={18} />} label="SCBA" count={1} collapsed={collapsed} />
        <CategoryItem icon={<Waves size={18} />} label="Mangueiras" count={1} collapsed={collapsed} />
        <CategoryItem icon={<Gauge size={18} />} label="Detectores" count={1} collapsed={collapsed} />
        <CategoryItem icon={<ArrowUp size={18} />} label="Altura" count={1} collapsed={collapsed} />
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <NavItem to="/categories" icon={<FolderOpen size={20} />} label="Categorias" collapsed={collapsed} />
        <NavItem to="/users" icon={<Users size={20} />} label="Usuários" collapsed={collapsed} />
        <NavItem to="/settings" icon={<Settings size={20} />} label="Configurações" collapsed={collapsed} />
      </div>

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
              <span className="text-sm">Recolher</span>
            </span>
          )}
        </Button>
      </div>
    </aside>
  );
}
