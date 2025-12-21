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
  Clock,
  Check,
  Menu,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
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
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useNavigate } from 'react-router-dom';
import { useShips } from '@/hooks/useShips';
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
import {
  markSystemNotificationRead,
  readSystemNotificationsRead,
  type SystemNotificationId,
} from '@/utils/systemNotificationsRead';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  admin_master: 'Admin Master',
  supervisor: 'Supervisor',
  technician: 'Técnico',
  viewer: 'Visualizador',
};

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const { user, profile, role, signOut } = useAuth();
  const { selectedShipId, setSelectedShipId, isFilterEnabled } = useShipFilter();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { data: ships = [] } = useShips();
  const { data: userShips = [] } = useUserShips(user?.id);
  const { data: stats } = useDashboardStats();
  const { data: allNotifications = [] } = useNotifications();
  const unreadNotifications = useUnreadNotifications();
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  // Get the selected ship name for display
  const selectedShipName = useMemo(() => {
    if (!selectedShipId) return 'Todas as Unidades';
    const ship = ships.find(s => s.id === selectedShipId);
    return ship?.name || 'Todas as Unidades';
  }, [selectedShipId, ships]);

  const [systemRead, setSystemRead] = useState<Record<string, string>>(() =>
    readSystemNotificationsRead()
  );

  const markSystemRead = useCallback(
    (id: SystemNotificationId, version: string = '1') => {
      const next = markSystemNotificationRead(id, version);
      setSystemRead(next);
    },
    []
  );

  // Check if user is admin (including admin_master which might come from database)
  const isAdmin = role === 'admin' || (role as string) === 'admin_master';

  const highPriorityCount =
    stats?.recentAlerts?.filter((a) => a.severity === 'high').length || 0;

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
      canMarkRead?: boolean;
    }> = [];

    // Add database notifications
    allNotifications.forEach((n) => {
      notifs.push({
        id: n.id,
        type: n.type as any,
        title: n.title,
        message: n.message,
        shipName: n.ship?.name,
        createdAt: n.created_at,
        isRead: n.is_read || false,
        isSystem: false,
        canMarkRead: true,
      });
    });

    // Add system reminder for filtering ships (only if not admin and has multiple ships)
    const shipFilterRead = systemRead['system-ship-filter'] === '1';
    if (!isAdmin && userShips.length > 1 && !shipFilterRead) {
      notifs.unshift({
        id: 'system-ship-filter',
        type: 'reminder',
        title: 'Filtrar por Navio',
        message: `Você tem acesso a ${userShips.length} navios. Lembre-se de filtrar os dados por navio no Dashboard.`,
        isRead: false,
        isSystem: true,
        canMarkRead: true,
      });
    }

    // Add alert for high priority items (mark as read stores current count, and reappears if count changes)
    if (highPriorityCount > 0) {
      const version = String(highPriorityCount);
      const isRead = systemRead['system-high-priority'] === version;

      notifs.unshift({
        id: 'system-high-priority',
        type: 'alert',
        title: 'Alertas Críticos',
        message: `${highPriorityCount} alerta(s) de alta prioridade requerem atenção.`,
        isRead,
        isSystem: true,
        canMarkRead: true,
      });
    }

    return notifs;
  }, [allNotifications, userShips, highPriorityCount, isAdmin, systemRead]);

  const unreadCount = combinedNotifications.filter((n) => !n.isRead).length;

  const handleMarkAsRead = useCallback(
    (notificationId: string, isSystem: boolean) => {
      if (isSystem) {
        if (notificationId === 'system-ship-filter') {
          markSystemRead('system-ship-filter', '1');
        }
        if (notificationId === 'system-high-priority') {
          markSystemRead('system-high-priority', String(highPriorityCount));
        }
        return;
      }
      markAsRead.mutate(notificationId);
    },
    [markAsRead, markSystemRead, highPriorityCount]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markSystemRead('system-ship-filter', '1');
    if (highPriorityCount > 0) {
      markSystemRead('system-high-priority', String(highPriorityCount));
    }
    markAllAsRead.mutate();
  }, [markAllAsRead, markSystemRead, highPriorityCount]);

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
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6">
      {/* Left side - Menu button for mobile */}
      <div className="flex items-center gap-3 flex-1">
        {showMenuButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden flex-shrink-0"
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Ship Indicator - hidden on mobile */}
        {userShips.length > 0 && (
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
            <Ship className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {userShips.length === 1 
                ? userShips[0]?.ship?.name || 'Navio'
                : `${userShips.length} navios`
              }
            </span>
          </div>
        )}

        {/* Ship Selector - Only for Admin/Admin Master */}
        {isFilterEnabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 hidden md:flex"
                data-tour="ship-filter"
              >
                <Ship className="h-4 w-4" />
                <span className="text-sm max-w-[120px] lg:max-w-[180px] truncate">{selectedShipName}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-lg z-50">
              <DropdownMenuLabel>Filtrar por Unidade</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="max-h-64">
                <DropdownMenuItem 
                  onClick={() => setSelectedShipId(null)}
                  className="gap-2"
                >
                  {selectedShipId === null && <Check className="h-4 w-4 text-primary" />}
                  <span className={selectedShipId === null ? 'font-medium' : ''}>
                    Todas as Unidades
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {ships.map((ship) => (
                  <DropdownMenuItem 
                    key={ship.id}
                    onClick={() => setSelectedShipId(ship.id)}
                    className="gap-2"
                  >
                    {selectedShipId === ship.id && <Check className="h-4 w-4 text-primary" />}
                    <span className={selectedShipId === ship.id ? 'font-medium' : ''}>
                      {ship.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

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
          <DropdownMenuContent align="end" className="w-80 sm:w-96 bg-popover border border-border shadow-lg z-50">
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
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleMarkAllAsRead();
                  }}
                >
                  <CheckCheck className="h-3 w-3" />
                  <span className="hidden sm:inline">Marcar todas</span>
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-80 sm:max-h-96">
              {combinedNotifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhuma notificação</p>
                  <p className="text-xs mt-1">Você está em dia!</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {combinedNotifications.slice(0, 5).map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 rounded-lg border transition-all ${getNotificationBg(notification.type, notification.isRead)}`}
                      onPointerDown={(e) => {
                        if (!notification.isRead && notification.canMarkRead) {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMarkAsRead(
                            notification.id,
                            notification.isSystem || false
                          );
                        }
                      }}
                      role={!notification.isRead && notification.canMarkRead ? 'button' : undefined}
                      tabIndex={!notification.isRead && notification.canMarkRead ? 0 : undefined}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${notification.isRead ? 'text-muted-foreground' : ''}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
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

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
          title={resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="gap-3 px-2 lg:px-4 h-12 hover:bg-muted/50 rounded-xl transition-all duration-200 group"
            >
              {/* Avatar with status indicator */}
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center flex-shrink-0 shadow-sm">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-primary-foreground">
                      {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                {/* Online status indicator */}
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-[1.5px] border-card" />
              </div>
              
              {/* User info - hidden on mobile */}
              <div className="text-left hidden lg:flex flex-col min-w-0">
                <p className="text-sm font-semibold truncate max-w-[140px] text-foreground group-hover:text-primary transition-colors">
                  {profile?.full_name || user?.email}
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    role === 'admin_master' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                    role === 'admin' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                    role === 'supervisor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                    role === 'technician' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {role ? roleLabels[role] : '...'}
                  </span>
                </div>
              </div>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block group-hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-xl z-50 rounded-xl p-1">
            {/* User header in dropdown */}
            <div className="px-3 py-3 bg-muted/50 rounded-lg mx-1 mb-1">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name} 
                      className="h-11 w-11 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-semibold text-primary-foreground">
                      {profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{profile?.full_name || user?.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    role === 'admin_master' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                    role === 'admin' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                    role === 'supervisor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                    role === 'technician' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {role ? roleLabels[role] : 'Carregando...'}
                  </span>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator className="my-1" />
            
            <DropdownMenuItem 
              className="gap-3 cursor-pointer py-2.5 px-3 rounded-lg mx-1 focus:bg-primary/10" 
              onClick={() => navigate('/profile')}
            >
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Meu Perfil</span>
                <span className="text-xs text-muted-foreground">Editar informações pessoais</span>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="gap-3 cursor-pointer py-2.5 px-3 rounded-lg mx-1 focus:bg-primary/10" 
              onClick={() => navigate('/settings')}
            >
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Settings className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Configurações</span>
                <span className="text-xs text-muted-foreground">Preferências do sistema</span>
              </div>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="my-1" />
            
            <DropdownMenuItem 
              className="gap-3 cursor-pointer py-2.5 px-3 rounded-lg mx-1 text-destructive focus:text-destructive focus:bg-destructive/10" 
              onClick={handleSignOut}
            >
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <LogOut className="h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Sair</span>
                <span className="text-xs opacity-70">Encerrar sessão</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
