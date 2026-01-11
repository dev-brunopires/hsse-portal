import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  Play,
  AlertTriangle,
  Calendar,
  Package,
  TrendingUp,
  Download,
  FileSpreadsheet,
  Eye,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import {
  useMaintenanceRequests,
  type MaintenanceRequestWithDetails,
} from '@/hooks/useMaintenanceRequests';
import { MaintenanceRequestDialog } from '@/components/maintenance/MaintenanceRequestDialog';
import { MaintenanceDetailDialog } from '@/components/maintenance/MaintenanceDetailDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { exportMaintenanceToPDF, exportMaintenanceToExcel } from '@/utils/exportMaintenance';
import { formatMaintenanceId } from '@/utils/formatId';
import { toast } from 'sonner';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useIsMobile, useIsTabletOrMobile } from '@/hooks/use-mobile';

const getStatusConfig = (t: (key: string) => string) => ({
  pending: { label: t('maintenance.statusPending'), icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  approved: { label: t('maintenance.statusApproved'), icon: CheckCircle2, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  in_progress: { label: t('maintenance.statusInProgress'), icon: Play, color: 'text-primary', bgColor: 'bg-primary/10' },
  completed: { label: t('maintenance.statusCompleted'), icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  rejected: { label: t('maintenance.statusRejected'), icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
});

const getPriorityConfig = (t: (key: string) => string) => ({
  low: { label: t('maintenance.priorityLow'), color: 'text-muted-foreground border-muted' },
  medium: { label: t('maintenance.priorityMedium'), color: 'text-blue-600 border-blue-300' },
  high: { label: t('maintenance.priorityHigh'), color: 'text-orange-600 border-orange-300' },
  critical: { label: t('maintenance.priorityCritical'), color: 'text-red-600 border-red-300' },
});

const getTypeLabels = (t: (key: string) => string) => ({
  preventive: t('maintenance.typePreventive'),
  corrective: t('maintenance.typeCorrective'),
});

export default function Maintenance() {
  const { t } = useTranslation();
  const statusConfig = getStatusConfig(t);
  const priorityConfig = getPriorityConfig(t);
  const typeLabels = getTypeLabels(t);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  const { data: requests = [], isLoading, isFetching, refetch } = useMaintenanceRequests();
  const { role } = useAuth();
  const branding = useOrganizationBranding();
  const isMobile = useIsMobile();
  const isTabletOrMobile = useIsTabletOrMobile();
  const [isExporting, setIsExporting] = useState(false);
  
  const isSyncing = isFetching && !isLoading;
  
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const { pullDistance, isRefreshing, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  // Derive stats from the same dataset rendered in the list to avoid badge/card mismatch.
  const stats = useMemo(() => {
    const acc = {
      total: requests.length,
      pending: 0,
      approved: 0,
      inProgress: 0,
      completed: 0,
      rejected: 0,
      preventive: 0,
      corrective: 0,
      critical: 0,
      high: 0,
    };

    for (const r of requests) {
      if (r.status === 'pending') acc.pending += 1;
      else if (r.status === 'approved') acc.approved += 1;
      else if (r.status === 'in_progress') acc.inProgress += 1;
      else if (r.status === 'completed') acc.completed += 1;
      else if (r.status === 'rejected') acc.rejected += 1;

      if (r.type === 'preventive') acc.preventive += 1;
      else if (r.type === 'corrective') acc.corrective += 1;

      if (r.priority === 'critical') acc.critical += 1;
      else if (r.priority === 'high') acc.high += 1;
    }

    return acc;
  }, [requests]);

  const isAdmin = role === 'admin' || (role as string) === 'admin_master';
  const canCreate = isAdmin || role === 'technician' || (role as string) === 'supervisor';

  const handleExportPDF = async (preview = false) => {
    if (filteredRequests.length === 0) {
      toast.error(t('maintenance.noRequestsToExport'));
      return;
    }
    setIsExporting(true);
    try {
      await exportMaintenanceToPDF(filteredRequests, 'manutencoes', branding, { preview });
      toast.success(preview ? t('common.pdfPreviewOpened') : t('maintenance.pdfExported'));
    } catch (error) {
      toast.error(t('maintenance.exportError'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (filteredRequests.length === 0) {
      toast.error(t('maintenance.noRequestsToExport'));
      return;
    }
    try {
      exportMaintenanceToExcel(filteredRequests, 'manutencoes');
      toast.success(t('maintenance.excelExported'));
    } catch (error) {
      toast.error(t('maintenance.exportError'));
    }
  };

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        req.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.equipment?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || req.status === statusFilter;

      // Type filter
      const matchesType = typeFilter === 'all' || req.type === typeFilter;

      // Tab filter
      let matchesTab = true;
      if (activeTab === 'pending') {
        matchesTab = req.status === 'pending' || req.status === 'approved';
      } else if (activeTab === 'in_progress') {
        matchesTab = req.status === 'in_progress';
      } else if (activeTab === 'completed') {
        matchesTab = req.status === 'completed';
      }

      return matchesSearch && matchesStatus && matchesType && matchesTab;
    });
  }, [requests, searchTerm, statusFilter, typeFilter, activeTab]);

  const openDetail = (request: MaintenanceRequestWithDetails) => {
    setSelectedRequestId(request.id);
    setDetailDialogOpen(true);
  };

  const StatCard = ({ title, value, icon: Icon, color, description }: { 
    title: string; 
    value: number; 
    icon: typeof Wrench; 
    color: string;
    description?: string;
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
            {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className={cn("p-3 rounded-full", color.replace('text-', 'bg-') + '/10')}>
            <Icon className={cn("h-5 w-5", color)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <PageHeader
          icon={Wrench}
          title={t('maintenance.title')}
          subtitle={t('maintenance.subtitle')}
          actions={
            <div className="flex items-center gap-2">
              {/* Sync indicator */}
              {isSyncing && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">{t('common.syncing')}</span>
                </div>
              )}
              
              {/* Refresh button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => refetch()}
                disabled={isFetching}
                title={t('common.refresh')}
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={isExporting || filteredRequests.length === 0}>
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {t('common.export')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExportPDF(true)} className="gap-2">
                    <Eye className="h-4 w-4" />
                    {t('common.previewPDF')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportPDF(false)} className="gap-2">
                    <Download className="h-4 w-4" />
                    {t('maintenance.exportPDF')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExportExcel} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    {t('maintenance.exportExcel')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {canCreate && (
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {t('maintenance.newRequest')}
                </Button>
              )}
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard 
            title={t('maintenance.pending')} 
            value={stats.pending} 
            icon={Clock} 
            color="text-amber-600"
            description={t('maintenance.awaitingApproval')}
          />
          <StatCard 
            title={t('maintenance.inProgress')} 
            value={stats.inProgress} 
            icon={Play} 
            color="text-primary"
          />
          <StatCard 
            title={t('maintenance.completed')} 
            value={stats.completed} 
            icon={CheckCircle2} 
            color="text-green-600"
          />
          <StatCard 
            title={t('maintenance.critical')} 
            value={stats.critical} 
            icon={AlertTriangle} 
            color="text-red-600"
            description={t('maintenance.highPriority')}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('maintenance.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('common.type')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('maintenance.allTypes')}</SelectItem>
                <SelectItem value="preventive">{t('maintenance.typePreventive')}</SelectItem>
                <SelectItem value="corrective">{t('maintenance.typeCorrective')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder={t('common.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('maintenance.allStatus')}</SelectItem>
                <SelectItem value="pending">{t('maintenance.statusPending')}</SelectItem>
                <SelectItem value="approved">{t('maintenance.statusApproved')}</SelectItem>
                <SelectItem value="in_progress">{t('maintenance.statusInProgress')}</SelectItem>
                <SelectItem value="completed">{t('maintenance.statusCompleted')}</SelectItem>
                <SelectItem value="rejected">{t('maintenance.statusRejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-4 md:w-auto md:inline-flex">
            <TabsTrigger value="all" className="gap-1 px-2 md:px-4">
              <span className="hidden sm:inline">{t('maintenance.all')}</span>
              <span className="sm:hidden text-xs">Todas</span>
              <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">{requests.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-1 px-2 md:px-4">
              <span className="hidden sm:inline">{t('maintenance.pending')}</span>
              <span className="sm:hidden text-xs">Pend.</span>
              <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">{stats.pending + stats.approved}</Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="gap-1 px-2 md:px-4">
              <span className="hidden sm:inline">{t('maintenance.inProgress')}</span>
              <span className="sm:hidden text-xs">Exec.</span>
              <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">{stats.inProgress}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-1 px-2 md:px-4">
              <span className="hidden sm:inline">{t('maintenance.completed')}</span>
              <span className="sm:hidden text-xs">Conc.</span>
              <Badge variant="secondary" className="text-[10px] md:text-xs px-1.5">{stats.completed}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div 
              ref={isMobile ? containerRef : undefined}
              className="md:overflow-visible overflow-auto"
            >
              <PullToRefreshIndicator 
                pullDistance={pullDistance} 
                isRefreshing={isRefreshing} 
              />
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                        ? t('maintenance.noRequestsFiltered')
                        : t('maintenance.noRequests')}
                    </p>
                    {canCreate && !searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                      <Button onClick={() => setCreateDialogOpen(true)} className="mt-4 gap-2">
                        <Plus className="h-4 w-4" />
                        {t('maintenance.createRequest')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map(request => {
                    const status = statusConfig[request.status];
                    const priority = priorityConfig[request.priority];
                    const StatusIcon = status.icon;

                  return (
                    <Card 
                      key={request.id} 
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => openDetail(request)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={cn('p-2 rounded-lg shrink-0', status.bgColor)}>
                              <StatusIcon className={cn('h-4 w-4', status.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {formatMaintenanceId(request.id)}
                                </span>
                                <h3 className="font-medium truncate">{request.title}</h3>
                                <Badge variant="outline" className={priority.color}>
                                  {priority.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Package className="h-3 w-3" />
                                  {request.equipment?.internal_code} - {request.equipment?.name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(request.requested_at)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge variant="outline">{typeLabels[request.type]}</Badge>
                            <Badge variant={request.status === 'completed' ? 'default' : 'secondary'} className="gap-1">
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      {/* Dialogs */}
      <MaintenanceRequestDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <MaintenanceDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        requestId={selectedRequestId}
      />
    </div>
  );
}
