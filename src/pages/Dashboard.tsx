import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Package, 
  AlertTriangle, 
  ClipboardCheck, 
  Shield, 
  Calendar, 
  Download,
  RefreshCw,
  LayoutDashboard,
  Wrench
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { ModernKPICard } from '@/components/dashboard/ModernKPICard';
import { ModernAlertsList } from '@/components/dashboard/ModernAlertsList';
import { ModernStatusChart } from '@/components/dashboard/ModernStatusChart';
import { ModernCategoryChart } from '@/components/dashboard/ModernCategoryChart';
import { ComplianceGauge } from '@/components/dashboard/ComplianceGauge';
import { EquipmentStatusByCategoryChart } from '@/components/dashboard/EquipmentStatusByCategoryChart';
import { EquipmentComplianceChart } from '@/components/dashboard/EquipmentComplianceChart';
import { UpcomingInspectionsCard } from '@/components/dashboard/UpcomingInspectionsCard';
import { ExpiringCertificatesCard } from '@/components/dashboard/ExpiringCertificatesCard';
import { CertificatesExpiringCard } from '@/components/dashboard/CertificatesExpiringCard';
import { DashboardFilters, type DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import { UpcomingMaintenanceCard } from '@/components/maintenance/UpcomingMaintenanceCard';
import { InspectorPerformanceCard } from '@/components/dashboard/InspectorPerformanceCard';
import { InspectionHeatmapCard } from '@/components/dashboard/InspectionHeatmapCard';
import { MaintenanceTrendChart } from '@/components/dashboard/MaintenanceTrendChart';
import { CriticalEquipmentCard } from '@/components/dashboard/CriticalEquipmentCard';
import { ActivityComparisonChart } from '@/components/dashboard/ActivityComparisonChart';
import { ComplianceTrendChart } from '@/components/dashboard/ComplianceTrendChart';
import { ShipComparisonChart } from '@/components/dashboard/ShipComparisonChart';
import { NonConformityResolutionCard } from '@/components/dashboard/NonConformityResolutionCard';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useShips } from '@/hooks/useShips';
import { useCategories } from '@/hooks/useCategories';
import { useRoutePrefetch } from '@/hooks/useRoutePrefetch';
import { useShipFilter } from '@/contexts/ShipFilterContext';

import { DashboardSkeleton } from '@/components/ui/SmartSkeletons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportDashboardPDF } from '@/utils/exportDashboardPDF';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;
  const queryClient = useQueryClient();
  const { selectedShipId, setSelectedShipId, isFilterEnabled } = useShipFilter();
  const { data: stats, isLoading, error, refetch, isFetching } = useDashboardStats();
  const { data: ships = [] } = useShips();
  const { data: categories = [] } = useCategories();
  const branding = useOrganizationBranding();
  
  // Prefetch data for common routes
  useRoutePrefetch();

  // Sync dashboard filters with global ship filter
  const [filters, setFiltersState] = useState<DashboardFiltersState>({
    shipId: selectedShipId || 'all',
    categoryId: 'all',
    startDate: undefined,
    endDate: undefined,
  });

  const setFilters = useCallback((newFilters: DashboardFiltersState) => {
    setFiltersState(newFilters);
    // Sync ship filter with global context so data actually re-fetches
    if (isFilterEnabled) {
      const newShipId = newFilters.shipId === 'all' ? null : newFilters.shipId;
      if (newShipId !== selectedShipId) {
        setSelectedShipId(newShipId);
      }
    }
  }, [isFilterEnabled, selectedShipId, setSelectedShipId]);

  // Get filter names for export
  const selectedShipName = useMemo(() => {
    if (filters.shipId === 'all') return undefined;
    return ships.find(s => s.id === filters.shipId)?.name;
  }, [filters.shipId, ships]);

  const selectedCategoryName = useMemo(() => {
    if (filters.categoryId === 'all') return undefined;
    return categories.find(c => c.id === filters.categoryId)?.name;
  }, [filters.categoryId, categories]);

  const handleExportPDF = async (preview: boolean = false) => {
    if (!stats) return;
    
    toast.info(t('common.loading'));
    
    await exportDashboardPDF(stats, {
      shipName: selectedShipName,
      categoryName: selectedCategoryName,
      startDate: filters.startDate,
      endDate: filters.endDate,
      branding,
    }, { preview });
    
    toast.success(preview ? t('dashboard.pdfPreviewOpened') : t('common.success'));
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    toast.success(t('common.refresh'));
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !stats) {
    // Provide fallback text if translations aren't loaded
    const errorMessage = t('errors.generic', { defaultValue: 'Algo deu errado. Tente novamente.' });
    const tryAgainText = t('common.tryAgain', { defaultValue: 'Tentar novamente' });
    
    // Check if it's a session/auth error
    const errorStr = error?.message?.toLowerCase() || '';
    const isSessionError = errorStr.includes('jwt') || 
                          errorStr.includes('session') || 
                          errorStr.includes('expired') ||
                          errorStr.includes('refresh');
    
    const handleRetry = async () => {
      if (isSessionError) {
        // Try to refresh the session first
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          // Session truly expired - redirect to login
          window.location.href = '/auth';
          return;
        }
      }
      refetch();
    };
    
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="p-4 bg-destructive/10 rounded-full">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <p className="text-muted-foreground">
          {isSessionError 
            ? t('errors.sessionExpired', { defaultValue: 'Sua sessão expirou. Faça login novamente.' })
            : errorMessage
          }
        </p>
        <Button variant="outline" onClick={handleRetry}>
          {isSessionError 
            ? t('auth.login', { defaultValue: 'Fazer Login' })
            : tryAgainText
          }
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl hidden sm:block">
            <LayoutDashboard className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{t('dashboard.updatedAt')} {format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale })}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportPDF(true)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.previewPDF')}</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => handleExportPDF(false)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('dashboard.exportPDF')}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <DashboardFilters
        filters={filters}
        onFiltersChange={setFilters}
        ships={ships}
        categories={categories.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <ModernKPICard
          title={t('dashboard.totalEquipment')}
          value={stats.totalEquipment}
          subtitle={t('dashboard.registeredInSystem')}
          icon={Package}
          variant="info"
        />
        <ModernKPICard
          title={t('dashboard.activeEquipment')}
          value={stats.activeEquipment}
          subtitle={stats.totalEquipment > 0 ? `${((stats.activeEquipment / stats.totalEquipment) * 100).toFixed(0)}% ${t('dashboard.ofTotal')}` : `0% ${t('dashboard.ofTotal')}`}
          icon={Shield}
          variant="success"
        />
        <ModernKPICard
          title={t('dashboard.expiredCertificates')}
          value={stats.expiredCertificates}
          subtitle={t('dashboard.expiredCerts')}
          icon={AlertTriangle}
          variant="danger"
        />
        <ModernKPICard
          title={t('dashboard.expiredEquipment')}
          value={stats.expiredEquipment}
          subtitle={t('dashboard.requireAction')}
          icon={AlertTriangle}
          variant="danger"
        />
        <ModernKPICard
          title={t('dashboard.pendingInspections')}
          value={stats.pendingInspections}
          subtitle={t('dashboard.next30Days')}
          icon={ClipboardCheck}
          variant="warning"
        />
        <ModernKPICard
          title={t('dashboard.pendingMaintenance')}
          value={stats.pendingMaintenance + stats.overdueMaintenance}
          subtitle={stats.overdueMaintenance > 0 ? `${stats.overdueMaintenance} ${t('dashboard.overdueCount')}` : t('dashboard.onSchedule')}
          icon={Wrench}
          variant={stats.overdueMaintenance > 0 ? 'danger' : 'warning'}
        />
      </div>

      {/* Compliance Rate Card */}
      <ComplianceGauge value={stats.complianceRate} target={95} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ModernCategoryChart data={stats.byCategory} />
        </div>
        <ModernStatusChart data={stats.byStatus} totalEquipment={stats.totalEquipment} />
      </div>

      {/* Charts Row 2 - Status by Category + Upcoming Inspections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <EquipmentStatusByCategoryChart />
        </div>
        <UpcomingInspectionsCard />
      </div>

      {/* Category Compliance + Activity Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EquipmentComplianceChart />
        <ActivityComparisonChart />
      </div>

      {/* Compliance Trend */}
      <ComplianceTrendChart />

      {/* Ship Comparison + NC Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShipComparisonChart />
        <NonConformityResolutionCard />
      </div>

      {/* Expiring Certificates - Equipment + Certificates Module */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpiringCertificatesCard />
        <CertificatesExpiringCard />
      </div>

      {/* Maintenance Trend + Upcoming Maintenance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <MaintenanceTrendChart />
        <UpcomingMaintenanceCard />
      </div>

      {/* Performance Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <InspectorPerformanceCard />
        <InspectionHeatmapCard />
      </div>

      {/* Critical Equipment + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CriticalEquipmentCard />
        <ModernAlertsList alerts={stats.recentAlerts} />
      </div>
    </div>
  );
}
