import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Bell, AlertTriangle, Clock, XCircle, CheckCircle, 
  Filter, Search, Ship, Calendar, ChevronRight,
  TrendingUp, ShieldAlert, Package
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useMarkAllNotificationsAsRead } from '@/hooks/useNotifications';
import { useShips } from '@/hooks/useShips';
import { useToast } from '@/hooks/use-toast';
import { markSystemNotificationRead } from '@/utils/systemNotificationsRead';
import { formatDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import type { Alert } from '@/types/equipment';

interface AlertCardProps {
  alert: Alert;
  onViewDetails: (alert: Alert) => void;
}

function AlertCard({ alert, onViewDetails }: AlertCardProps) {
  const { t } = useTranslation();
  
  const alertTypeConfig = {
    expired: { 
      icon: XCircle, 
      color: 'text-status-danger', 
      bg: 'bg-status-danger/10', 
      border: 'border-status-danger/30',
      label: t('alerts.typeExpired'),
      description: t('alerts.descExpired')
    },
    expiring: { 
      icon: Clock, 
      color: 'text-status-warning', 
      bg: 'bg-status-warning/10', 
      border: 'border-status-warning/30',
      label: t('alerts.typeExpiring'),
      description: t('alerts.descExpiring')
    },
    inspection_due: { 
      icon: Bell, 
      color: 'text-accent', 
      bg: 'bg-accent/10', 
      border: 'border-accent/30',
      label: t('alerts.typeInspectionDue'),
      description: t('alerts.descInspectionDue')
    },
    non_compliant: { 
      icon: AlertTriangle, 
      color: 'text-status-danger', 
      bg: 'bg-status-danger/10', 
      border: 'border-status-danger/30',
      label: t('alerts.typeNonCompliant'),
      description: t('alerts.descNonCompliant')
    },
    maintenance_overdue: {
      icon: AlertTriangle,
      color: 'text-status-danger',
      bg: 'bg-status-danger/10',
      border: 'border-status-danger/30',
      label: t('alerts.typeMaintenanceOverdue'),
      description: t('alerts.descMaintenanceOverdue')
    },
    maintenance_pending: {
      icon: Clock,
      color: 'text-status-warning',
      bg: 'bg-status-warning/10',
      border: 'border-status-warning/30',
      label: t('alerts.typeMaintenancePending'),
      description: t('alerts.descMaintenancePending')
    },
  };

  const severityConfig = {
    high: { label: t('alerts.high'), color: 'text-status-danger', bg: 'bg-status-danger/10', border: 'border-status-danger/30' },
    medium: { label: t('alerts.medium'), color: 'text-status-warning', bg: 'bg-status-warning/10', border: 'border-status-warning/30' },
    low: { label: t('alerts.low'), color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  };

  const config = alertTypeConfig[alert.type];
  const severity = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:shadow-md",
        "border-l-4",
        alert.severity === 'high' && "border-l-status-danger",
        alert.severity === 'medium' && "border-l-status-warning",
        alert.severity === 'low' && "border-l-accent"
      )}
      onClick={() => onViewDetails(alert)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-3 rounded-xl shrink-0 transition-transform group-hover:scale-110',
            config.bg
          )}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-xs', config.bg, config.color, config.border)}>
                {config.label}
              </Badge>
              <Badge variant="outline" className={cn('text-xs', severity.bg, severity.color, severity.border)}>
                {t('alerts.priority')} {severity.label}
              </Badge>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground line-clamp-1">
                {alert.equipmentName}
              </h4>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                {alert.messageKey 
                  ? (alert.reasonKeys && alert.reasonKeys.length > 0
                      ? `${t(alert.messageKey)}: ${alert.reasonKeys.map(key => t(key)).join(', ')}`
                      : alert.messageParams?.title
                        ? `${t(alert.messageKey)}: ${alert.messageParams.title}`
                        : t(alert.messageKey)
                    )
                  : alert.message
                }
              </p>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(alert.date)}
              </span>
            </div>
          </div>
          
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  color, 
  bgColor,
  trend 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className={cn('w-1.5', bgColor)} />
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className={cn('text-3xl font-bold mt-1', color)}>{value}</p>
                {trend && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {trend}
                  </p>
                )}
              </div>
              <div className={cn('p-3 rounded-xl', bgColor)}>
                <Icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Alerts() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const markAllNotificationsAsRead = useMarkAllNotificationsAsRead();
  const { data: stats, isLoading, error } = useDashboardStats();
  const { data: ships } = useShips();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  const alerts = stats?.recentAlerts || [];
  
  const highCount = alerts.filter(a => a.severity === 'high').length;
  const mediumCount = alerts.filter(a => a.severity === 'medium').length;
  const lowCount = alerts.filter(a => a.severity === 'low').length;

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Filter by tab/severity
      if (activeTab !== 'all' && alert.severity !== activeTab) return false;
      
      // Filter by type
      if (typeFilter !== 'all' && alert.type !== typeFilter) return false;
      
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesEquipment = alert.equipmentName?.toLowerCase().includes(search);
        const matchesMessage = alert.message.toLowerCase().includes(search);
        if (!matchesEquipment && !matchesMessage) return false;
      }
      
      return true;
    });
  }, [alerts, activeTab, typeFilter, searchTerm]);

  const handleMarkAllAsRead = () => {
    markSystemNotificationRead('system-ship-filter', '1');
    if (highCount > 0) {
      markSystemNotificationRead('system-high-priority', String(highCount));
    }
    markAllNotificationsAsRead.mutate();
    toast({
      title: t('alerts.markedAsRead'),
      description: t('alerts.notificationsMarkedAsRead'),
    });
  };

  const handleViewDetails = (alert: Alert) => {
    // Navigate to equipment page with the equipment highlighted
    navigate(`/equipment?highlight=${alert.equipmentId}`);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-60 mt-2" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <p className="text-destructive font-medium">{t('alerts.errorLoadingAlerts')}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <PageHeader
        icon={Bell}
        title={t('alerts.title')}
        subtitle={t('alerts.subtitle')}
        actions={
          <Button 
            variant="outline" 
            className="gap-2 shrink-0" 
            onClick={handleMarkAllAsRead}
            disabled={alerts.length === 0}
          >
            <CheckCircle className="h-4 w-4" />
            {t('alerts.markAllAsRead')}
          </Button>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('alerts.totalAlerts')}
          value={alerts.length}
          icon={Bell}
          color="text-foreground"
          bgColor="bg-primary"
        />
        <StatCard
          title={t('alerts.highPriority')}
          value={highCount}
          icon={AlertTriangle}
          color="text-status-danger"
          bgColor="bg-status-danger"
        />
        <StatCard
          title={t('alerts.mediumPriority')}
          value={mediumCount}
          icon={Clock}
          color="text-status-warning"
          bgColor="bg-status-warning"
        />
        <StatCard
          title={t('alerts.lowPriority')}
          value={lowCount}
          icon={Package}
          color="text-accent"
          bgColor="bg-accent"
        />
      </div>

      {/* Filters and Tabs */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle>{t('alerts.alertList')}</CardTitle>
              <CardDescription>
                {filteredAlerts.length} {t('alerts.ofAlerts', { total: alerts.length })}
              </CardDescription>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('alerts.searchAlerts')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
              </div>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('common.type')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('alerts.allTypes')}</SelectItem>
                  <SelectItem value="expired">{t('alerts.expired')}</SelectItem>
                  <SelectItem value="expiring">{t('alerts.expiring')}</SelectItem>
                  <SelectItem value="inspection_due">{t('alerts.inspection')}</SelectItem>
                  <SelectItem value="non_compliant">{t('alerts.nonCompliant')}</SelectItem>
                  <SelectItem value="maintenance_overdue">{t('alerts.maintenanceOverdue')}</SelectItem>
                  <SelectItem value="maintenance_pending">{t('alerts.maintenancePending')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-muted/50 p-1">
              <TabsTrigger value="all" className="gap-2">
                {t('alerts.all')}
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {alerts.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="high" className="gap-2">
                <span className="hidden sm:inline">{t('alerts.high')}</span>
                <Badge className="bg-status-danger/20 text-status-danger hover:bg-status-danger/30 h-5 px-1.5 text-xs">
                  {highCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="medium" className="gap-2">
                <span className="hidden sm:inline">{t('alerts.medium')}</span>
                <Badge className="bg-status-warning/20 text-status-warning hover:bg-status-warning/30 h-5 px-1.5 text-xs">
                  {mediumCount}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="low" className="gap-2">
                <span className="hidden sm:inline">{t('alerts.low')}</span>
                <Badge className="bg-accent/20 text-accent hover:bg-accent/30 h-5 px-1.5 text-xs">
                  {lowCount}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-4">
              {filteredAlerts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-status-success/10 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-8 w-8 text-status-success" />
                  </div>
                  <p className="text-lg font-medium text-foreground">
                    {searchTerm || typeFilter !== 'all' 
                      ? t('alerts.noAlertFound') 
                      : t('alerts.noActiveAlerts')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {searchTerm || typeFilter !== 'all'
                      ? t('alerts.adjustFilters')
                      : t('alerts.allEquipmentCompliant')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pb-4">
                  {filteredAlerts.map((alert) => (
                    <AlertCard 
                      key={alert.id} 
                      alert={alert} 
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}