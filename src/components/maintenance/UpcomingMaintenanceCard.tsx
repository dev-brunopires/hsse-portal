import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Wrench, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  Plus,
  MoreHorizontal,
  PlayCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUpcomingMaintenance, useCompleteMaintenance, type MaintenancePlan } from '@/hooks/useMaintenance';
import { MaintenancePlanDialog } from './MaintenancePlanDialog';
import { CompleteMaintenanceDialog } from './CompleteMaintenanceDialog';

const priorityConfig = {
  low: { label: 'Baixa', color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400' },
  medium: { label: 'Média', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  high: { label: 'Alta', color: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  critical: { label: 'Crítica', color: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const frequencyLabels: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export function UpcomingMaintenanceCard() {
  const { data: maintenancePlans = [], isLoading } = useUpcomingMaintenance(30);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const getStatusInfo = (nextDueDate: string) => {
    const daysUntilDue = Math.ceil(
      (new Date(nextDueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilDue < 0) {
      return { status: 'overdue', label: 'Atrasada', color: 'text-red-500' };
    } else if (daysUntilDue === 0) {
      return { status: 'due', label: 'Hoje', color: 'text-amber-500' };
    } else if (daysUntilDue <= 7) {
      return { status: 'soon', label: `${daysUntilDue}d`, color: 'text-amber-500' };
    } else {
      return { status: 'ok', label: `${daysUntilDue}d`, color: 'text-muted-foreground' };
    }
  };

  const handleComplete = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    setShowCompleteDialog(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Manutenções Preventivas</CardTitle>
                <CardDescription>Próximos 30 dias</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Novo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : maintenancePlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma manutenção programada</p>
            </div>
          ) : (
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-4">
                {maintenancePlans.map((plan) => {
                  const statusInfo = getStatusInfo(plan.next_due_date);
                  const priority = priorityConfig[plan.priority];
                  
                  return (
                    <div
                      key={plan.id}
                      className="p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {plan.title}
                            </span>
                            <Badge variant="outline" className={priority.color}>
                              {priority.label}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {plan.equipment?.name} - {plan.equipment?.internal_code}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(plan.next_due_date), 'dd/MM/yyyy', { locale: ptBR })}
                            </span>
                            <span className={`flex items-center gap-1 font-medium ${statusInfo.color}`}>
                              <Clock className="h-3 w-3" />
                              {statusInfo.label}
                            </span>
                            <span className="text-muted-foreground">
                              {frequencyLabels[plan.frequency]}
                            </span>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleComplete(plan)}>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Registrar Execução
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <MaintenancePlanDialog 
        open={showCreateDialog} 
        onOpenChange={setShowCreateDialog}
      />

      {selectedPlan && (
        <CompleteMaintenanceDialog
          open={showCompleteDialog}
          onOpenChange={setShowCompleteDialog}
          plan={selectedPlan}
        />
      )}
    </>
  );
}
