import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Wrench, 
  Calendar, 
  Clock, 
  CheckCircle2,
  Plus,
  ArrowRight,
  AlertTriangle,
  PlayCircle,
  Pause,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useMaintenanceRequests } from '@/hooks/useMaintenanceRequests';
import { MaintenanceRequestDialog } from './MaintenanceRequestDialog';
import { MaintenanceDetailDialog } from './MaintenanceDetailDialog';
import { cn } from '@/lib/utils';

const statusConfig = {
  pending: { 
    label: 'Pendente', 
    icon: Clock, 
    color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dotColor: 'bg-amber-500'
  },
  approved: { 
    label: 'Aprovada', 
    icon: CheckCircle2, 
    color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    dotColor: 'bg-blue-500'
  },
  in_progress: { 
    label: 'Em Execução', 
    icon: PlayCircle, 
    color: 'bg-primary/15 text-primary',
    dotColor: 'bg-primary'
  },
  completed: { 
    label: 'Concluída', 
    icon: CheckCircle2, 
    color: 'bg-green-500/15 text-green-600 dark:text-green-400',
    dotColor: 'bg-green-500'
  },
  rejected: { 
    label: 'Rejeitada', 
    icon: XCircle, 
    color: 'bg-red-500/15 text-red-600 dark:text-red-400',
    dotColor: 'bg-red-500'
  },
};

const priorityConfig = {
  low: { label: 'Baixa', color: 'text-slate-500' },
  medium: { label: 'Média', color: 'text-blue-500' },
  high: { label: 'Alta', color: 'text-amber-500' },
  critical: { label: 'Crítica', color: 'text-red-500' },
};

export function UpcomingMaintenanceCard() {
  const navigate = useNavigate();
  const { data: maintenanceRequests = [], isLoading } = useMaintenanceRequests();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  // Filter active requests (not completed or rejected)
  const activeRequests = maintenanceRequests.filter(
    r => r.status !== 'completed' && r.status !== 'rejected'
  );

  // Stats
  const stats = {
    pending: maintenanceRequests.filter(r => r.status === 'pending').length,
    approved: maintenanceRequests.filter(r => r.status === 'approved').length,
    inProgress: maintenanceRequests.filter(r => r.status === 'in_progress').length,
    completed: maintenanceRequests.filter(r => r.status === 'completed').length,
    overdue: maintenanceRequests.filter(r => {
      if (r.status === 'completed' || r.status === 'rejected') return false;
      return r.due_date && r.due_date < today;
    }).length,
  };

  const totalActive = stats.pending + stats.approved + stats.inProgress;
  const progressPercent = totalActive > 0 
    ? Math.round((stats.inProgress / totalActive) * 100) 
    : 0;

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return dueDate < today;
  };

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Manutenções</CardTitle>
                <CardDescription>Acompanhamento geral</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Nova
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="text-center p-2 rounded-lg bg-amber-500/10">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.pending}</div>
              <div className="text-[10px] text-muted-foreground">Pendentes</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-blue-500/10">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.approved}</div>
              <div className="text-[10px] text-muted-foreground">Aprovadas</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-primary/10">
              <div className="text-lg font-bold text-primary">{stats.inProgress}</div>
              <div className="text-[10px] text-muted-foreground">Em Exec.</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-green-500/10">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.completed}</div>
              <div className="text-[10px] text-muted-foreground">Concluídas</div>
            </div>
          </div>

          {/* Overdue Alert */}
          {stats.overdue > 0 && (
            <div className="flex items-center gap-2 p-2 mb-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                {stats.overdue} manutenção(ões) atrasada(s)
              </span>
            </div>
          )}

          {/* Active Requests List */}
          {isLoading ? (
            <div className="space-y-2 flex-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : activeRequests.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2 text-green-500/50" />
              <p className="text-sm font-medium">Nenhuma manutenção ativa</p>
              <p className="text-xs">Todas as manutenções foram concluídas</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-2 px-2" style={{ maxHeight: '200px' }}>
              <div className="space-y-2">
                {activeRequests.slice(0, 6).map((request) => {
                  const status = statusConfig[request.status];
                  const StatusIcon = status.icon;
                  const priority = priorityConfig[request.priority];
                  const overdue = isOverdue(request.due_date);
                  
                  return (
                    <div
                      key={request.id}
                      onClick={() => setSelectedRequestId(request.id)}
                      className={cn(
                        "p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                        overdue 
                          ? "border-red-500/30 bg-red-500/5" 
                          : "border-border bg-card hover:bg-muted/50"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full shrink-0", status.dotColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm truncate">
                              {request.title}
                            </span>
                            {overdue && (
                              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="truncate">{request.equipment?.internal_code}</span>
                            <span>•</span>
                            <span className={priority.color}>{priority.label}</span>
                            {request.due_date && (
                              <>
                                <span>•</span>
                                <span className={overdue ? 'text-red-500' : ''}>
                                  {format(new Date(request.due_date), 'dd/MM', { locale: ptBR })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className={cn("text-[10px] h-5 shrink-0", status.color)}>
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* View All Button */}
          {activeRequests.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-3 w-full text-xs"
              onClick={() => navigate('/maintenance')}
            >
              Ver todas as manutenções
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      <MaintenanceRequestDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />

      <MaintenanceDetailDialog
        requestId={selectedRequestId}
        open={!!selectedRequestId}
        onOpenChange={(open) => !open && setSelectedRequestId(null)}
      />
    </>
  );
}
