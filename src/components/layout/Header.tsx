import { useState, useMemo } from 'react';
import { 
  Bell, 
  Search, 
  User, 
  ChevronDown, 
  LogOut, 
  Settings, 
  UserCircle,
  Ship,
  AlertTriangle,
  Info,
  X,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useUnits } from '@/hooks/useUnits';
import { useUserShips } from '@/hooks/useUserShips';
import { useDashboardStats } from '@/hooks/useDashboardStats';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  admin_master: 'Admin Master',
  supervisor: 'Supervisor',
  technician: 'Técnico',
  viewer: 'Visualizador',
};

interface Notification {
  id: string;
  type: 'info' | 'warning' | 'reminder';
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const { data: userShips = [] } = useUserShips(user?.id);
  const { data: stats } = useDashboardStats();
  
  const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
    const stored = localStorage.getItem('dismissed-notifications');
    return stored ? JSON.parse(stored) : [];
  });

  const dismissNotification = (id: string) => {
    const updated = [...dismissedNotifications, id];
    setDismissedNotifications(updated);
    localStorage.setItem('dismissed-notifications', JSON.stringify(updated));
  };

  // Generate notifications
  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    
    // Reminder to filter ships if user has multiple ships assigned
    if (userShips.length > 1) {
      notifs.push({
        id: 'filter-ships-reminder',
        type: 'reminder',
        title: 'Filtrar por Navio',
        message: `Você tem acesso a ${userShips.length} navios. Lembre-se de filtrar os dados por navio para visualizar informações específicas.`,
        action: {
          label: 'Ir para Dashboard',
          onClick: () => navigate('/'),
        },
        dismissible: true,
      });
    }

    // Reminder for users with ships but none selected
    if (userShips.length === 1 && userShips[0]?.ship) {
      notifs.push({
        id: 'single-ship-info',
        type: 'info',
        title: `Navio: ${userShips[0].ship.name}`,
        message: 'Você está visualizando dados deste navio.',
        dismissible: true,
      });
    }

    // Alert for pending items
    if (stats?.recentAlerts && stats.recentAlerts.length > 0) {
      const highPriorityCount = stats.recentAlerts.filter(a => a.severity === 'high').length;
      if (highPriorityCount > 0) {
        notifs.push({
          id: 'high-priority-alerts',
          type: 'warning',
          title: 'Alertas Críticos',
          message: `Você tem ${highPriorityCount} alerta(s) de alta prioridade que requerem atenção imediata.`,
          action: {
            label: 'Ver Alertas',
            onClick: () => navigate('/alerts'),
          },
        });
      }
    }

    // Filter out dismissed notifications
    return notifs.filter(n => !dismissedNotifications.includes(n.id) || !n.dismissible);
  }, [userShips, stats, dismissedNotifications, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      case 'reminder':
        return <Filter className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getNotificationBg = (type: Notification['type']) => {
    switch (type) {
      case 'warning':
        return 'bg-status-warning/10 border-status-warning/30';
      case 'reminder':
        return 'bg-primary/10 border-primary/30';
      default:
        return 'bg-muted/50 border-muted';
    }
  };

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar equipamentos, códigos, localização..."
            className="pl-10 bg-background border-border focus:border-primary"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Ship Indicator */}
        {userShips.length > 0 && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
            <Ship className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {userShips.length === 1 
                ? userShips[0]?.ship?.name || 'Navio'
                : `${userShips.length} navios`
              }
            </span>
          </div>
        )}

        {/* Unit Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <span className="text-sm">{profile?.unit || 'Todas as Unidades'}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel>Selecionar Unidade</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {units.map((unit) => (
              <DropdownMenuItem key={unit}>{unit}</DropdownMenuItem>
            ))}
            {units.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem>Todas as Unidades</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-status-danger text-status-danger-foreground text-xs">
                  {notifications.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Notificações</span>
              {notifications.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {notifications.length}
                </Badge>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-80">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma notificação</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg border ${getNotificationBg(notification.type)} relative`}
                    >
                      {notification.dismissible && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissNotification(notification.id);
                          }}
                          className="absolute top-2 right-2 p-1 hover:bg-background/50 rounded"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                      <div className="flex items-start gap-2 pr-6">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {notification.message}
                          </p>
                          {notification.action && (
                            <Button
                              variant="link"
                              size="sm"
                              className="h-auto p-0 mt-2 text-xs"
                              onClick={notification.action.onClick}
                            >
                              {notification.action.label} →
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="justify-center text-primary cursor-pointer"
                  onClick={() => navigate('/alerts')}
                >
                  Ver todos os alertas
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.full_name} 
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
              <div className="text-left hidden md:block">
                <p className="text-sm font-medium">{profile?.full_name || user?.email}</p>
                <p className="text-xs text-muted-foreground">
                  {role ? roleLabels[role] : 'Carregando...'}
                </p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate('/profile')}>
              <UserCircle className="h-4 w-4" />
              Perfil
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="gap-2 text-destructive cursor-pointer"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
