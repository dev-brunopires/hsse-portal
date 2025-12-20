import { useState, useMemo, useCallback } from 'react';
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
  Filter,
  CheckCheck,
  AlertCircle,
  Clock
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
import { 
  useNotifications, 
  useUnreadNotifications, 
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead 
} from '@/hooks/useNotifications';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  admin_master: 'Admin Master',
  supervisor: 'Supervisor',
  technician: 'Técnico',
  viewer: 'Visualizador',
};

export function Header() {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const { data: units = [] } = useUnits();
  const { data: userShips = [] } = useUserShips(user?.id);
  const { data: stats } = useDashboardStats();
  const { data: allNotifications = [] } = useNotifications();
  const unreadNotifications = useUnreadNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();
  
  // State to force re-render when system notifications are dismissed
  const [dismissedSystemNotifications, setDismissedSystemNotifications] = useState<Set<string>>(() => {
    const dismissed = new Set<string>();
    if (localStorage.getItem('ship-filter-reminder-dismissed')) {
      dismissed.add('system-ship-filter');
    }
    return dismissed;
  });

  // Check if user is admin (including admin_master which might come from database)
  const isAdmin = role === 'admin' || (role as string) === 'admin_master';

  // Combine system notifications with database notifications
  const combinedNotifications = useMemo(() => {
    const notifs: Array<{
      id: string;
      type: 'info' | 'warning' | 'alert' | 'reminder';
      title: string;
      message: string;
      shipName?: string;
      createdAt?: string;
      isRead: boolean;
      isSystem?: boolean;
    }> = [];
    
    // Add database notifications
    allNotifications.forEach(n => {
      notifs.push({
        id: n.id,
        type: n.type as any,
        title: n.title,
        message: n.message,
        shipName: n.ship?.name,
        createdAt: n.created_at,
        isRead: n.is_read || false,
        isSystem: false,
      });
    });

    // Add system reminder for filtering ships (only if not admin and has multiple ships)
    if (!isAdmin && userShips.length > 1 && !dismissedSystemNotifications.has('system-ship-filter')) {
      notifs.unshift({
        id: 'system-ship-filter',
        type: 'reminder',
        title: 'Filtrar por Navio',
        message: `Você tem acesso a ${userShips.length} navios. Lembre-se de filtrar os dados por navio no Dashboard.`,
        isRead: false,
        isSystem: true,
      });
    }

    // Add alert for high priority items (this one can't be dismissed)
    const highPriorityCount = stats?.recentAlerts?.filter(a => a.severity === 'high').length || 0;
    if (highPriorityCount > 0) {
      notifs.unshift({
        id: 'system-high-priority',
        type: 'alert',
        title: 'Alertas Críticos',
        message: `${highPriorityCount} alerta(s) de alta prioridade requerem atenção.`,
        isRead: false,
        isSystem: true,
      });
    }

    return notifs;
  }, [allNotifications, userShips, stats, isAdmin, dismissedSystemNotifications]);

  const unreadCount = combinedNotifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = useCallback((notificationId: string, isSystem: boolean) => {
    if (isSystem) {
      if (notificationId === 'system-ship-filter') {
        localStorage.setItem('ship-filter-reminder-dismissed', 'true');
        setDismissedSystemNotifications(prev => new Set([...prev, 'system-ship-filter']));
      }
      return;
    }
    markAsRead.mutate(notificationId);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(() => {
    // Dismiss system notifications
    localStorage.setItem('ship-filter-reminder-dismissed', 'true');
    setDismissedSystemNotifications(prev => new Set([...prev, 'system-ship-filter']));
    // Mark database notifications as read
    markAllAsRead.mutate();
  }, [markAllAsRead]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-status-warning" />;
      case 'reminder':
        return <Clock className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getNotificationBg = (type: string, isRead: boolean) => {
    if (isRead) return 'bg-muted/30 border-muted opacity-60';
    
    switch (type) {
      case 'alert':
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-status-warning/10 border-status-warning/30';
      case 'reminder':
        return 'bg-primary/10 border-primary/30';
      default:
        return 'bg-blue-500/10 border-blue-500/30';
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
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-status-danger text-status-danger-foreground text-xs">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Notificações</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} não lidas
                  </Badge>
                )}
              </div>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto py-1 px-2 text-xs gap-1"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMarkAllAsRead();
                  }}
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-96">
              {combinedNotifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhuma notificação</p>
                  <p className="text-xs mt-1">Você está em dia!</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {combinedNotifications.map((notification) => (
                    <div 
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-all ${getNotificationBg(notification.type, notification.isRead)}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium text-sm ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                              {notification.title}
                            </p>
                            {notification.shipName && (
                              <Badge variant="outline" className="text-xs py-0">
                                <Ship className="h-2.5 w-2.5 mr-1" />
                                {notification.shipName}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            {notification.createdAt ? (
                              <p className="text-xs text-muted-foreground/70">
                                {format(new Date(notification.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            ) : (
                              <span />
                            )}
                            {!notification.isRead &&
                              (!notification.isSystem || notification.id === 'system-ship-filter') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs gap-1"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id, notification.isSystem || false);
                                }}
                              >
                                <CheckCheck className="h-3 w-3" />
                                Marcar como lida
                              </Button>
                            )}
                          </div>
                        </div>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="justify-center text-primary cursor-pointer"
              onClick={() => navigate('/alerts')}
            >
              Ver todos os alertas
            </DropdownMenuItem>
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
