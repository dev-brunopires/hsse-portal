import { useState } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  Camera,
  PenTool
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InspectionWithDetails } from '@/hooks/useInspections';

const statusConfig: Record<string, { 
  label: string; 
  color: string; 
  bgColor: string;
  borderColor: string;
  icon: typeof CheckCircle 
}> = {
  compliant: { 
    label: 'Conforme', 
    color: 'text-status-success', 
    bgColor: 'bg-status-success/10',
    borderColor: 'border-status-success',
    icon: CheckCircle 
  },
  attention: { 
    label: 'Atenção', 
    color: 'text-status-warning', 
    bgColor: 'bg-status-warning/10',
    borderColor: 'border-status-warning',
    icon: AlertTriangle 
  },
  'non-compliant': { 
    label: 'Não Conforme', 
    color: 'text-status-danger', 
    bgColor: 'bg-status-danger/10',
    borderColor: 'border-status-danger',
    icon: XCircle 
  },
  pending: { 
    label: 'Pendente', 
    color: 'text-muted-foreground', 
    bgColor: 'bg-muted/50',
    borderColor: 'border-muted',
    icon: Clock 
  },
};

interface InspectionTimelineProps {
  inspections: InspectionWithDetails[];
  onViewDetails?: (inspection: InspectionWithDetails) => void;
  maxItems?: number;
}

export function InspectionTimeline({ 
  inspections, 
  onViewDetails,
  maxItems 
}: InspectionTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const displayedInspections = maxItems && !showAll 
    ? inspections.slice(0, maxItems) 
    : inspections;

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  if (inspections.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhuma inspeção registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

        {displayedInspections.map((inspection, index) => {
          const config = statusConfig[inspection.status] || statusConfig.pending;
          const StatusIcon = config.icon;
          const isExpanded = expandedItems.has(inspection.id);
          const inspectionDate = new Date(inspection.inspection_date);

          return (
            <div key={inspection.id} className="relative pl-12 pb-6 last:pb-0">
              {/* Timeline dot */}
              <div className={cn(
                "absolute left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                config.bgColor,
                config.borderColor
              )}>
                <StatusIcon className={cn("h-3 w-3", config.color)} />
              </div>

              <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(inspection.id)}>
                <Card className={cn(
                  "transition-all hover:shadow-md cursor-pointer",
                  isExpanded && "ring-1 ring-primary/20"
                )}>
                  <CollapsibleTrigger asChild>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", config.color, config.bgColor)}
                            >
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                            {inspection.signature_data && (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <PenTool className="h-3 w-3" />
                                Assinado
                              </Badge>
                            )}
                          </div>

                          <h4 className="font-medium text-foreground truncate">
                            {inspection.equipment?.internal_code} - {inspection.equipment?.name}
                          </h4>

                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[150px]">
                                {inspection.profiles?.full_name || 'Inspetor'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {format(inspectionDate, "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {formatDistanceToNow(inspectionDate, { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t border-border">
                      <div className="pt-4 space-y-4">
                        {inspection.observations && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Observações
                            </h5>
                            <p className="text-sm text-foreground bg-muted/50 rounded p-2">
                              {inspection.observations}
                            </p>
                          </div>
                        )}

                        {inspection.recommendations && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1">
                              Recomendações
                            </h5>
                            <p className="text-sm text-foreground bg-muted/50 rounded p-2">
                              {inspection.recommendations}
                            </p>
                          </div>
                        )}

                        {inspection.actions_taken && (
                          <div>
                            <h5 className="text-xs font-medium text-muted-foreground mb-1">
                              Ações Tomadas
                            </h5>
                            <p className="text-sm text-foreground bg-muted/50 rounded p-2">
                              {inspection.actions_taken}
                            </p>
                          </div>
                        )}

                        {inspection.next_inspection_date && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Próxima inspeção:</span>
                            <Badge variant="outline">
                              {format(new Date(inspection.next_inspection_date), "dd/MM/yyyy", { locale: ptBR })}
                            </Badge>
                          </div>
                        )}

                        {onViewDetails && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(inspection);
                            }}
                          >
                            Ver Detalhes Completos
                          </Button>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </div>
          );
        })}
      </div>

      {maxItems && inspections.length > maxItems && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>Mostrar menos</>
          ) : (
            <>Ver todas as {inspections.length} inspeções</>
          )}
        </Button>
      )}
    </div>
  );
}
