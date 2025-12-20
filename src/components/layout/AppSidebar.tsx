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
  User,
  AlertCircle,
  Moon,
  Sun,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import sbmLogoWhite from '@/assets/sbm-logo-white.svg';
import sbmLogoColor from '@/assets/sbm-logo.svg';

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
};

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { isAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        'h-screen bg-sidebar flex flex-col border-r border-sidebar-border transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border px-4',
        collapsed && 'justify-center px-2'
      )}>
        {collapsed ? (
          <div className="w-10 h-10 flex items-center justify-center">
            <img src={sbmLogoWhite} alt="SBM" className="h-6 w-auto object-contain" />
          </div>
        ) : (
          <img src={sbmLogoWhite} alt="SBM Offshore" className="h-6 w-auto" />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div data-tour="dashboard">
          <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={collapsed} />
        </div>
        <div data-tour="equipment">
          <NavItem to="/equipment" icon={<Package size={20} />} label="Equipamentos" collapsed={collapsed} />
        </div>
        <div data-tour="inspections">
          <NavItem to="/inspections" icon={<ClipboardCheck size={20} />} label="Inspeções" collapsed={collapsed} />
        </div>
        <NavItem to="/pending" icon={<AlertCircle size={20} />} label="Pendências" collapsed={collapsed} />
        <div data-tour="reports">
          <NavItem to="/reports" icon={<FileText size={20} />} label="Relatórios" collapsed={collapsed} />
        </div>
        <div data-tour="alerts">
          <NavItem to="/alerts" icon={<Bell size={20} />} label="Alertas" collapsed={collapsed} />
        </div>
        <NavItem to="/categories" icon={<FolderOpen size={20} />} label="Categorias" collapsed={collapsed} />
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full',
            'hover:bg-sidebar-accent text-sidebar-foreground',
            collapsed && 'justify-center px-2'
          )}
        >
          <span className="flex-shrink-0">
            {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </span>
          {!collapsed && (
            <span className="text-sm">
              {resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          )}
        </button>
        
        <div data-tour="profile">
          <NavItem to="/profile" icon={<User size={20} />} label="Meu Perfil" collapsed={collapsed} />
        </div>
        {isAdmin && (
          <>
            <NavItem to="/users" icon={<Users size={20} />} label="Usuários" collapsed={collapsed} />
            <NavItem to="/audit-log" icon={<History size={20} />} label="Histórico" collapsed={collapsed} />
            <NavItem to="/settings" icon={<Settings size={20} />} label="Configurações" collapsed={collapsed} />
          </>
        )}
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
