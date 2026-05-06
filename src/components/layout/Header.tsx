import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Bell, 
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
  Sun,
  Languages,
  FileCheck,
  Star
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { GlobalSearchTrigger } from '@/components/global-search/GlobalSearchTrigger';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { useShips } from '@/hooks/useShips';
import { useUserShips } from '@/hooks/useUserShips';
import { useFavoriteShip, useSetFavoriteShip } from '@/hooks/useFavoriteShip';
import { 
  useNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead 
} from '@/hooks/useNotifications';
import { useCertificates } from '@/hooks/useCertificates';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  markSystemNotificationRead,
  readSystemNotificationsRead,
  type SystemNotificationId,
} from '@/utils/systemNotificationsRead';
import { SyncButton } from '@/components/layout/SyncButton';

interface HeaderProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { user, profile, role, signOut, isPlatformOwner, sessionUnstable, forceRefreshSession, profileLoading } = useAuth();
  const [isReconnecting, setIsReconnecting] = useState(false);
  const { selectedShipId, setSelectedShipId, isFilterEnabled } = useShipFilter();
  const { language, setLanguage } = useLanguage();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { data: ships = [] } = useShips();
  const { data: userShips = [] } = useUserShips(user?.id);
  const { data: favoriteShipId } = useFavoriteShip();
  const setFavoriteShip = useSetFavoriteShip();
  const { data: allNotifications = [] } = useNotifications();
  // Perf #6: Only load certificates for admin roles
  const isAdminRole = role === 'admin' || role === 'admin_master' || isPlatformOwner;
  const { data: allCertificates = [] } = useCertificates({ enabled: isAdminRole });
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  // Calculate expiring certificates count (within 30 days)
  const expiringCertificatesCount = useMemo(() => {
    const today = new Date();
    return allCertificates.filter(cert => {
      if (!cert.expiry_date) return false;
      const daysUntil = differenceInDays(parseISO(cert.expiry_date), today);
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
  }, [allCertificates]);

  const expiredCertificatesCount = useMemo(() => {
    const today = new Date();
    return allCertificates.filter(cert => {
      if (!cert.expiry_date) return false;
      return parseISO(cert.expiry_date) < today;
    }).length;
  }, [allCertificates]);

  const dateLocale = i18n.language === 'en' ? enUS : ptBR;

  const roleLabels: Record<string, string> = {
    admin: t('roles.admin'),
    admin_master: t('roles.admin_master'),
    supervisor: t('roles.supervisor'),
    technician: t('roles.technician'),
    viewer: t('roles.viewer'),
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  // Get the selected ship name for display
  const selectedShipName = useMemo(() => {
    if (!selectedShipId) return t('header.allUnits');
    const ship = ships.find(s => s.id === selectedShipId);
    return ship?.name || t('header.allUnits');
  }, [selectedShipId, ships, t]);

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

  const highPriorityCount = useMemo(
    () => allNotifications.filter((n) => n.type === 'alert' && !n.is_read).length,
    [allNotifications]
  );

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
        title: t('header.filterByShip'),
        message: t('header.shipFilterReminder', { count: userShips.length }),
        isRead: false,
        isSystem: true,
        canMarkRead: true,
      });
    }

    // Add alert for high priority items (only reappears if count INCREASES from when it was marked read)
    if (highPriorityCount > 0) {
      const savedCount = parseInt(systemRead['system-high-priority'] || '0', 10);
      // Only show as unread if current count is greater than when it was last dismissed
      const isRead = savedCount >= highPriorityCount;

      notifs.unshift({
        id: 'system-high-priority',
        type: 'alert',
        title: t('header.criticalAlerts'),
        message: t('header.criticalAlertsMessage', { count: highPriorityCount }),
        isRead,
        isSystem: true,
        canMarkRead: true,
      });
    }

    // Add alert for expired certificates
    if (expiredCertificatesCount > 0) {
      const savedCount = parseInt(systemRead['system-cert-expired'] || '0', 10);
      const isRead = savedCount >= expiredCertificatesCount;

      notifs.unshift({
        id: 'system-cert-expired',
        type: 'alert',
        title: t('header.expiredCertificates'),
        message: t('header.expiredCertificatesMessage', { count: expiredCertificatesCount }),
        isRead,
        isSystem: true,
        canMarkRead: true,
      });
    }

    // Add warning for expiring certificates (within 30 days)
    if (expiringCertificatesCount > 0) {
      const savedCount = parseInt(systemRead['system-cert-expiring'] || '0', 10);
      const isRead = savedCount >= expiringCertificatesCount;

      notifs.unshift({
        id: 'system-cert-expiring',
        type: 'warning',
        title: t('header.expiringCertificates'),
        message: t('header.expiringCertificatesMessage', { count: expiringCertificatesCount }),
        isRead,
        isSystem: true,
        canMarkRead: true,
      });
    }

    return notifs;
  }, [allNotifications, userShips, highPriorityCount, expiringCertificatesCount, expiredCertificatesCount, isAdmin, systemRead, t]);

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
        if (notificationId === 'system-cert-expired') {
          markSystemRead('system-cert-expired', String(expiredCertificatesCount));
        }
        if (notificationId === 'system-cert-expiring') {
          markSystemRead('system-cert-expiring', String(expiringCertificatesCount));
        }
        return;
      }
      markAsRead.mutate(notificationId);
    },
    [markAsRead, markSystemRead, highPriorityCount, expiringCertificatesCount, expiredCertificatesCount]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markSystemRead('system-ship-filter', '1');
    if (highPriorityCount > 0) {
      markSystemRead('system-high-priority', String(highPriorityCount));
    }
    if (expiredCertificatesCount > 0) {
      markSystemRead('system-cert-expired', String(expiredCertificatesCount));
    }
    if (expiringCertificatesCount > 0) {
      markSystemRead('system-cert-expiring', String(expiringCertificatesCount));
    }
    markAllAsRead.mutate();
  }, [markAllAsRead, markSystemRead, highPriorityCount, expiringCertificatesCount, expiredCertificatesCount]);

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
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 overflow-visible pwa-header">
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
      <div className="flex items-center gap-1 sm:gap-2 lg:gap-4">
        {/* Mobile Quick Actions - Language Toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-muted-foreground hover:text-foreground"
              title={t('header.language')}
            >
              <Languages className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel>{t('header.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLanguage('pt-BR')}
              className="gap-2"
            >
              {language === 'pt-BR' && <Check className="h-4 w-4 text-primary" />}
              <span className={language === 'pt-BR' ? 'font-medium' : ''}>Português</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className="gap-2"
            >
              {language === 'en' && <Check className="h-4 w-4 text-primary" />}
              <span className={language === 'en' ? 'font-medium' : ''}>English</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile Quick Actions - Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="lg:hidden text-muted-foreground hover:text-foreground"
          title={resolvedTheme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
        >
          {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        {/* Mobile/Tablet Ship Selector - Only for Admin/Admin Master - Uses Drawer */}
        {isFilterEnabled && (
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-muted-foreground hover:text-foreground relative"
                title={t('header.filterByUnit')}
              >
                <Ship className="h-5 w-5" />
                {selectedShipId && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader className="text-left">
                <DrawerTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5 text-primary" />
                  {t('header.filterByUnit')}
                </DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-1">
                <DrawerClose asChild>
                  <button
                    onClick={() => setSelectedShipId(null)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                      selectedShipId === null 
                        ? "bg-primary/10 text-primary font-medium" 
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="w-5 flex-shrink-0">
                      {selectedShipId === null && <Check className="h-5 w-5 text-primary" />}
                    </span>
                    <span>{t('header.allUnits')}</span>
                  </button>
                </DrawerClose>
                <div className="h-px bg-border my-2" />
                <ScrollArea className="max-h-[50vh]">
                  <div className="space-y-1">
                    {ships.map((ship) => (
                      <div key={ship.id} className="flex items-center gap-1">
                        <DrawerClose asChild>
                          <button
                            onClick={() => setSelectedShipId(ship.id)}
                            className={cn(
                              "flex-1 flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors",
                              selectedShipId === ship.id 
                                ? "bg-primary/10 text-primary font-medium" 
                                : "hover:bg-muted"
                            )}
                          >
                            <span className="w-5 flex-shrink-0">
                              {selectedShipId === ship.id && <Check className="h-5 w-5 text-primary" />}
                            </span>
                            <span>{ship.name}</span>
                          </button>
                        </DrawerClose>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const isUnfavoriting = favoriteShipId === ship.id;
                            setFavoriteShip.mutate({ shipId: isUnfavoriting ? null : ship.id, shipName: ship.name });
                            // Bug #2: When unfavoriting, go back to "All Units"
                            if (isUnfavoriting) {
                              setSelectedShipId(null);
                            } else {
                              setSelectedShipId(ship.id);
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                          title={t('hooks.favoriteShip.tooltip')}
                        >
                          <Star
                            className={cn(
                              "h-4 w-4 transition-colors",
                              favoriteShipId === ship.id
                                ? "fill-amber-400 text-amber-400"
                                : "text-muted-foreground"
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </DrawerContent>
          </Drawer>
        )}

        {/* Global Search */}
        <div className="hidden lg:block">
          <GlobalSearchTrigger />
        </div>
        <GlobalSearchTrigger variant="compact" className="lg:hidden" />

        {/* Ship Indicator - hidden on mobile */}
        {userShips.length > 0 && (
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
            <Ship className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {userShips.length === 1 
                ? userShips[0]?.ship?.name || t('header.ship')
                : `${userShips.length} ${t('header.ships')}`
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
              <DropdownMenuLabel>{t('header.filterByUnit')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="max-h-80">
                <DropdownMenuItem 
                  onClick={() => setSelectedShipId(null)}
                  className="gap-2"
                >
                  {selectedShipId === null && <Check className="h-4 w-4 text-primary" />}
                  <span className={selectedShipId === null ? 'font-medium' : ''}>
                    {t('header.allUnits')}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {ships.map((ship) => (
                  <DropdownMenuItem 
                    key={ship.id}
                    onClick={() => setSelectedShipId(ship.id)}
                    className="gap-2 justify-between"
                  >
                    <div className="flex items-center gap-2">
                      {selectedShipId === ship.id && <Check className="h-4 w-4 text-primary" />}
                      <span className={selectedShipId === ship.id ? 'font-medium' : ''}>
                        {ship.name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const isUnfavoriting = favoriteShipId === ship.id;
                        setFavoriteShip.mutate({ shipId: isUnfavoriting ? null : ship.id, shipName: ship.name });
                        // Bug #2: When unfavoriting, go back to "All Units"
                        if (isUnfavoriting) {
                          setSelectedShipId(null);
                        } else {
                          setSelectedShipId(ship.id);
                        }
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={t('hooks.favoriteShip.tooltip')}
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5 transition-colors",
                          favoriteShipId === ship.id
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  </DropdownMenuItem>
                ))}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sync / Cache Button */}
        <SyncButton />

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
                <span>{t('header.notifications')}</span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} {t('header.unreadNotifications')}
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
                  <span className="hidden sm:inline">{t('header.markAll')}</span>
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ScrollArea className="max-h-80 sm:max-h-96">
              {combinedNotifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">{t('header.noNotifications')}</p>
                  <p className="text-xs mt-1">{t('header.upToDate')}</p>
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
              {t('header.viewAllAlerts')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language Selector - Desktop only */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex text-muted-foreground hover:text-foreground"
              title={t('header.language')}
            >
              <Languages className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-popover border border-border shadow-lg z-50">
            <DropdownMenuLabel>{t('header.language')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setLanguage('pt-BR')}
              className="gap-2"
            >
              {language === 'pt-BR' && <Check className="h-4 w-4 text-primary" />}
              <span className={language === 'pt-BR' ? 'font-medium' : ''}>Português</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLanguage('en')}
              className="gap-2"
            >
              {language === 'en' && <Check className="h-4 w-4 text-primary" />}
              <span className={language === 'en' ? 'font-medium' : ''}>English</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle - Desktop only */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden lg:flex text-muted-foreground hover:text-foreground"
          title={resolvedTheme === 'dark' ? t('header.lightMode') : t('header.darkMode')}
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
                {profileLoading ? (
                  <Skeleton className="h-9 w-9 rounded-full" />
                ) : (
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
                )}
                {/* Online status indicator - only show when not loading */}
                {!profileLoading && (
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-[1.5px] border-card" />
                )}
              </div>
              
              {/* User info - hidden on mobile */}
              <div className="text-left hidden lg:flex flex-col min-w-0">
                {profileLoading ? (
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold truncate max-w-[140px] text-foreground group-hover:text-primary transition-colors">
                      {profile?.full_name || user?.email}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isPlatformOwner ? 'bg-primary/15 text-primary' :
                        role === 'admin_master' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                        role === 'admin' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                        role === 'supervisor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                        role === 'technician' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isPlatformOwner ? t('navigation.platformAdmin') : role ? roleLabels[role] : t('common.loading')}
                      </span>
                    </div>
                  </>
                )}
              </div>
              
              <ChevronDown className="h-4 w-4 text-muted-foreground hidden lg:block group-hover:text-primary transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-popover border border-border shadow-xl z-50 rounded-xl p-1">
            {/* User header in dropdown */}
            <div className="px-3 py-3 bg-muted/50 rounded-lg mx-1 mb-1">
              <div className="flex items-center gap-3">
                {profileLoading ? (
                  <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm flex-shrink-0">
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
                )}
                <div className="flex-1 min-w-0">
                  {profileLoading ? (
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="h-4 w-16 mt-1" />
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-sm truncate">{profile?.full_name || user?.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        isPlatformOwner ? 'bg-primary/15 text-primary' :
                        role === 'admin_master' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400' :
                        role === 'admin' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' :
                        role === 'supervisor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                        role === 'technician' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isPlatformOwner ? t('navigation.platformAdmin') : role ? roleLabels[role] : t('common.loading')}
                      </span>
                    </>
                  )}
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
                <span className="text-sm font-medium">{t('navigation.profile')}</span>
                <span className="text-xs text-muted-foreground">{t('profile.updatePersonalInfo')}</span>
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
                <span className="text-sm font-medium">{t('navigation.settings')}</span>
                <span className="text-xs text-muted-foreground">{t('settings.subtitle')}</span>
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
                <span className="text-sm font-medium">{t('auth.logout')}</span>
                <span className="text-xs opacity-70">{t('auth.logoutSuccess')}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Session Unstable Banner */}
      {sessionUnstable && (
        <div className="absolute left-0 right-0 top-full z-50 bg-amber-500/90 dark:bg-amber-600/90 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm shadow-md animate-in slide-in-from-top-2 duration-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="font-medium">{t('header.sessionUnstable', { defaultValue: 'Sessão instável — reconectando...' })}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={isReconnecting}
            onClick={async () => {
              setIsReconnecting(true);
              await forceRefreshSession();
              setIsReconnecting(false);
            }}
            className="h-7 px-3 bg-white/20 hover:bg-white/30 text-white border-0"
          >
            {isReconnecting ? t('common.loading', { defaultValue: 'Carregando...' }) : t('header.reconnect', { defaultValue: 'Reconectar' })}
          </Button>
        </div>
      )}
    </header>
  );
}
