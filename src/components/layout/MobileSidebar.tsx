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
  User,
  AlertCircle,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import sbmLogoWhite from '@/assets/sbm-logo-white.png';

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
  const { isAdmin } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const handleNavClick = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="left" 
        className="w-72 p-0 bg-sidebar border-sidebar-border"
      >
        <SheetHeader className="h-16 flex flex-row items-center justify-between border-b border-sidebar-border px-4">
          <div className="flex items-center gap-3">
            <img src={sbmLogoWhite} alt="SBM Offshore" className="h-10" />
          </div>
        </SheetHeader>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <MobileNavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" onClick={handleNavClick} />
          <MobileNavItem to="/equipment" icon={<Package size={20} />} label="Equipamentos" onClick={handleNavClick} />
          <MobileNavItem to="/inspections" icon={<ClipboardCheck size={20} />} label="Inspeções" onClick={handleNavClick} />
          <MobileNavItem to="/pending" icon={<AlertCircle size={20} />} label="Pendências" onClick={handleNavClick} />
          <MobileNavItem to="/reports" icon={<FileText size={20} />} label="Relatórios" onClick={handleNavClick} />
          <MobileNavItem to="/alerts" icon={<Bell size={20} />} label="Alertas" onClick={handleNavClick} />
          <MobileNavItem to="/categories" icon={<FolderOpen size={20} />} label="Categorias" onClick={handleNavClick} />
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-sidebar-border p-3 space-y-1">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 w-full hover:bg-sidebar-accent text-sidebar-foreground"
          >
            <span className="flex-shrink-0">
              {resolvedTheme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </span>
            <span className="text-sm">
              {resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          </button>
          
          <MobileNavItem to="/profile" icon={<User size={20} />} label="Meu Perfil" onClick={handleNavClick} />
          {isAdmin && (
            <MobileNavItem to="/users" icon={<Users size={20} />} label="Usuários" onClick={handleNavClick} />
          )}
          <MobileNavItem to="/settings" icon={<Settings size={20} />} label="Configurações" onClick={handleNavClick} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
