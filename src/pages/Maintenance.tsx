import { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import { 
  useMaintenanceRequests, 
  useMaintenanceStats,
  type MaintenanceStatus,
  type MaintenanceRequestWithDetails,
} from '@/hooks/useMaintenanceRequests';
import { MaintenanceRequestDialog } from '@/components/maintenance/MaintenanceRequestDialog';
import { MaintenanceDetailDialog } from '@/components/maintenance/MaintenanceDetailDialog';
import { useAuth } from '@/contexts/AuthContext';

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bgColor: string }> = {
  pending: { label: 'Pendente', icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50 dark:bg-amber-950/30' },
  approved: { label: 'Aprovada', icon: CheckCircle2, color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/30' },
  in_progress: { label: 'Em Execução', icon: Play, color: 'text-primary', bgColor: 'bg-primary/10' },
  completed: { label: 'Concluída', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30' },
  rejected: { label: 'Rejeitada', icon: XCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'text-muted-foreground border-muted' },
  medium: { label: 'Média', color: 'text-blue-600 border-blue-300' },
  high: { label: 'Alta', color: 'text-orange-600 border-orange-300' },
  critical: { label: 'Crítica', color: 'text-red-600 border-red-300' },
};

const typeLabels: Record<string, string> = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
};

export default function Maintenance() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('all');

  const { data: requests = [], isLoading } = useMaintenanceRequests();
  const { data: stats } = useMaintenanceStats();
  const { role } = useAuth();

  const isAdmin = role === 'admin' || (role as string) === 'admin_master';
  const canCreate = isAdmin || role === 'technician' || (role as string) === 'supervisor';

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
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              Manutenção
            </h1>
            <p className="text-muted-foreground">
              Gerencie solicitações de manutenção preventiva e corretiva
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Solicitação
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="Pendentes" 
            value={stats?.pending || 0} 
            icon={Clock} 
            color="text-amber-600"
            description="Aguardando aprovação"
          />
          <StatCard 
            title="Em Execução" 
            value={stats?.inProgress || 0} 
            icon={Play} 
            color="text-primary"
          />
          <StatCard 
            title="Concluídas" 
            value={stats?.completed || 0} 
            icon={CheckCircle2} 
            color="text-green-600"
          />
          <StatCard 
            title="Críticas" 
            value={stats?.critical || 0} 
            icon={AlertTriangle} 
            color="text-red-600"
            description="Alta prioridade"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, equipamento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="preventive">Preventiva</SelectItem>
                <SelectItem value="corrective">Corretiva</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovada</SelectItem>
                <SelectItem value="in_progress">Em Execução</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="rejected">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs & List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all" className="gap-2">
              Todas
              <Badge variant="secondary" className="ml-1">{requests.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="gap-2">
              Pendentes
              <Badge variant="secondary" className="ml-1">{(stats?.pending || 0) + (stats?.approved || 0)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="gap-2">
              Em Execução
              <Badge variant="secondary" className="ml-1">{stats?.inProgress || 0}</Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              Concluídas
              <Badge variant="secondary" className="ml-1">{stats?.completed || 0}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
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
                      ? 'Nenhuma solicitação encontrada com os filtros aplicados.'
                      : 'Nenhuma solicitação de manutenção registrada.'}
                  </p>
                  {canCreate && !searchTerm && statusFilter === 'all' && typeFilter === 'all' && (
                    <Button onClick={() => setCreateDialogOpen(true)} className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      Criar Solicitação
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
