import { useState, useMemo } from 'react';
import { 
  Package, 
  AlertTriangle, 
  ClipboardCheck, 
  Shield, 
  Calendar, 
  Download,
  RefreshCw,
  LayoutDashboard
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ModernKPICard } from '@/components/dashboard/ModernKPICard';
import { ModernAlertsList } from '@/components/dashboard/ModernAlertsList';
import { ModernStatusChart } from '@/components/dashboard/ModernStatusChart';
import { ModernCategoryChart } from '@/components/dashboard/ModernCategoryChart';
import { ComplianceGauge } from '@/components/dashboard/ComplianceGauge';
import { InspectionTrendChart } from '@/components/dashboard/InspectionTrendChart';
import { UpcomingInspectionsCard } from '@/components/dashboard/UpcomingInspectionsCard';
import { ExpiringCertificatesCard } from '@/components/dashboard/ExpiringCertificatesCard';
import { DashboardFilters, type DashboardFiltersState } from '@/components/dashboard/DashboardFilters';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useShips } from '@/hooks/useShips';
import { useCategories } from '@/hooks/useCategories';
import { CardSkeleton, ChartSkeleton, ListSkeleton } from '@/components/ui/table-skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { exportDashboardPDF } from '@/utils/exportDashboardPDF';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading, error, refetch, isFetching } = useDashboardStats();
  const { data: ships = [] } = useShips();
  const { data: categories = [] } = useCategories();
  
  const [filters, setFilters] = useState<DashboardFiltersState>({
    shipId: 'all',
    categoryId: 'all',
    startDate: undefined,
    endDate: undefined,
  });

  // Get filter names for export
  const selectedShipName = useMemo(() => {
    if (filters.shipId === 'all') return undefined;
    return ships.find(s => s.id === filters.shipId)?.name;
  }, [filters.shipId, ships]);

  const selectedCategoryName = useMemo(() => {
    if (filters.categoryId === 'all') return undefined;
    return categories.find(c => c.id === filters.categoryId)?.name;
  }, [filters.categoryId, categories]);

  const handleExportPDF = async () => {
    if (!stats) return;
    
    toast.info('Gerando relatório...');
    
    await exportDashboardPDF(stats, {
      shipName: selectedShipName,
      categoryName: selectedCategoryName,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
    
    toast.success('Relatório exportado com sucesso!');
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    toast.success('Dados atualizados!');
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do sistema de gestão de equipamentos</p>
          </div>
        </div>
        
        {/* KPI Cards Skeleton */}
        <CardSkeleton count={4} />
        
        {/* Compliance Skeleton */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-40 bg-muted rounded animate-pulse" />
              <div className="h-4 w-60 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-24 w-24 bg-muted rounded-full animate-pulse" />
          </div>
        </div>
        
        {/* Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
          <ListSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="p-4 bg-red-500/10 rounded-full">
          <AlertTriangle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-muted-foreground">Erro ao carregar estatísticas</p>
        <Button variant="outline" onClick={() => refetch()}>
          Tentar novamente
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
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Visão geral do sistema de gestão de equipamentos</p>
            <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Atualizado em {format(new Date(), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}</span>
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
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExportPDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ModernKPICard
          title="Total de Equipamentos"
          value={stats.totalEquipment}
          subtitle="Cadastrados no sistema"
          icon={Package}
          variant="info"
        />
        <ModernKPICard
          title="Equipamentos Ativos"
          value={stats.activeEquipment}
          subtitle={stats.totalEquipment > 0 ? `${((stats.activeEquipment / stats.totalEquipment) * 100).toFixed(0)}% do total` : '0% do total'}
          icon={Shield}
          variant="success"
        />
        <ModernKPICard
          title="Certificados Vencidos"
          value={stats.expiredCertificates}
          subtitle="Certificados expirados"
          icon={AlertTriangle}
          variant="danger"
        />
        <ModernKPICard
          title="Status Vencido/Reprovado"
          value={stats.expiredEquipment}
          subtitle="Requerem ação imediata"
          icon={AlertTriangle}
          variant="danger"
        />
        <ModernKPICard
          title="Inspeções Pendentes"
          value={stats.pendingInspections}
          subtitle="Próximos 30 dias"
          icon={ClipboardCheck}
          variant="warning"
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

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <InspectionTrendChart />
        </div>
        <UpcomingInspectionsCard />
      </div>

      {/* Expiring Certificates */}
      <ExpiringCertificatesCard />

      {/* Alerts */}
      <ModernAlertsList alerts={stats.recentAlerts} />
    </div>
  );
}
