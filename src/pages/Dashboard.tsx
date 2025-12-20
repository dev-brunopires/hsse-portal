import { Package, AlertTriangle, ClipboardCheck, TrendingUp, Calendar, Shield, Loader2 } from 'lucide-react';
import { KPICard } from '@/components/dashboard/KPICard';
import { AlertsList } from '@/components/dashboard/AlertsList';
import { StatusChart } from '@/components/dashboard/StatusChart';
import { CategoryChart } from '@/components/dashboard/CategoryChart';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do sistema de gestão de equipamentos</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-32 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Erro ao carregar estatísticas</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do sistema de gestão de equipamentos</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>Atualizado em {new Date().toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: 'long', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de Equipamentos"
          value={stats.totalEquipment}
          subtitle="Cadastrados no sistema"
          icon={Package}
          variant="default"
        />
        <KPICard
          title="Equipamentos Ativos"
          value={stats.activeEquipment}
          subtitle={stats.totalEquipment > 0 ? `${((stats.activeEquipment / stats.totalEquipment) * 100).toFixed(0)}% do total` : '0% do total'}
          icon={Shield}
          variant="success"
        />
        <KPICard
          title="Vencidos / Reprovados"
          value={stats.expiredEquipment}
          subtitle="Requerem ação imediata"
          icon={AlertTriangle}
          variant="danger"
        />
        <KPICard
          title="Inspeções Pendentes"
          value={stats.pendingInspections}
          subtitle="Próximos 30 dias"
          icon={ClipboardCheck}
          variant="warning"
        />
      </div>

      {/* Compliance Rate Card */}
      <div className="bg-gradient-to-r from-primary to-accent rounded-xl p-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">Taxa de Conformidade Geral</p>
            <p className="text-4xl font-bold mt-1">{stats.complianceRate}%</p>
            <p className="text-sm opacity-75 mt-2">
              <TrendingUp className="inline h-4 w-4 mr-1" />
              Equipamentos em conformidade
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-75">Meta Mensal</p>
            <p className="text-2xl font-semibold">95%</p>
            <div className="mt-2 w-32 h-2 bg-primary-foreground/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary-foreground rounded-full transition-all duration-500"
                style={{ width: `${Math.min((stats.complianceRate / 95) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <CategoryChart data={stats.byCategory} />
          <StatusChart data={stats.byStatus} />
        </div>
        <div>
          <AlertsList alerts={stats.recentAlerts} />
        </div>
      </div>
    </div>
  );
}
