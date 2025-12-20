import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  isToday,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { InspectionWithDetails } from '@/hooks/useInspections';

interface InspectionCalendarProps {
  inspections: InspectionWithDetails[];
  onInspectionClick: (inspection: InspectionWithDetails) => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  compliant: { label: 'Conforme', color: 'text-status-success', bgColor: 'bg-status-success', icon: CheckCircle },
  attention: { label: 'Atenção', color: 'text-status-warning', bgColor: 'bg-status-warning', icon: AlertTriangle },
  'non-compliant': { label: 'Não Conforme', color: 'text-status-danger', bgColor: 'bg-status-danger', icon: XCircle },
  pending: { label: 'Pendente', color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Clock },
};

export function InspectionCalendar({ inspections, onInspectionClick }: InspectionCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });
  const calendarEnd = endOfWeek(monthEnd, { locale: ptBR });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group inspections by date
  const inspectionsByDate = useMemo(() => {
    const grouped = new Map<string, InspectionWithDetails[]>();
    
    inspections.forEach(inspection => {
      const dateKey = inspection.inspection_date;
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(inspection);
    });

    // Also add next inspection dates
    inspections.forEach(inspection => {
      if (inspection.next_inspection_date) {
        const dateKey = inspection.next_inspection_date;
        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, []);
        }
        // Add as upcoming (with a marker)
        const existing = grouped.get(dateKey)!;
        if (!existing.some(i => i.id === inspection.id)) {
          grouped.get(dateKey)!.push({
            ...inspection,
            _isUpcoming: true,
          } as InspectionWithDetails & { _isUpcoming?: boolean });
        }
      }
    });

    return grouped;
  }, [inspections]);

  const getInspectionsForDay = (date: Date): InspectionWithDetails[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return inspectionsByDate.get(dateKey) || [];
  };

  const getDayStatus = (dayInspections: InspectionWithDetails[]) => {
    if (dayInspections.length === 0) return null;
    
    const hasNonCompliant = dayInspections.some(i => i.status === 'non-compliant');
    const hasAttention = dayInspections.some(i => i.status === 'attention');
    const hasCompliant = dayInspections.some(i => i.status === 'compliant');
    
    if (hasNonCompliant) return 'non-compliant';
    if (hasAttention) return 'attention';
    if (hasCompliant) return 'compliant';
    return 'pending';
  };

  const handleDayClick = (date: Date) => {
    const dayInspections = getInspectionsForDay(date);
    if (dayInspections.length > 0) {
      setSelectedDate(date);
      setDayDialogOpen(true);
    }
  };

  const selectedDateInspections = selectedDate ? getInspectionsForDay(selectedDate) : [];

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week days header */}
          <div className="grid grid-cols-7 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayInspections = getInspectionsForDay(day);
              const dayStatus = getDayStatus(dayInspections);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  disabled={dayInspections.length === 0}
                  className={cn(
                    "relative h-12 sm:h-16 p-1 rounded-lg border transition-colors text-sm",
                    isCurrentMonth ? "bg-card" : "bg-muted/30 text-muted-foreground",
                    isTodayDate && "ring-2 ring-primary",
                    dayInspections.length > 0 && "cursor-pointer hover:bg-accent",
                    dayInspections.length === 0 && "cursor-default"
                  )}
                >
                  <span className={cn(
                    "block text-xs sm:text-sm font-medium",
                    isTodayDate && "text-primary font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {dayInspections.length > 0 && (
                    <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-0.5">
                      {dayInspections.length <= 3 ? (
                        dayInspections.map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              statusConfig[dayStatus || 'pending'].bgColor
                            )}
                          />
                        ))
                      ) : (
                        <Badge 
                          variant="secondary" 
                          className={cn(
                            "text-[10px] px-1 py-0 h-4",
                            statusConfig[dayStatus || 'pending'].bgColor,
                            "text-white"
                          )}
                        >
                          {dayInspections.length}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            {Object.entries(statusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                <div className={cn("w-2.5 h-2.5 rounded-full", config.bgColor)} />
                <span className="text-muted-foreground">{config.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Day Details Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Inspeções - {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {selectedDateInspections.map((inspection) => {
                const config = statusConfig[inspection.status] || statusConfig.pending;
                const Icon = config.icon;
                const isUpcoming = (inspection as any)._isUpcoming;
                
                return (
                  <button
                    key={inspection.id + (isUpcoming ? '-upcoming' : '')}
                    onClick={() => {
                      onInspectionClick(inspection);
                      setDayDialogOpen(false);
                    }}
                    className="w-full p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-full", config.bgColor + '/20')}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">
                            {inspection.equipment?.name || 'Equipamento'}
                          </p>
                          {isUpcoming && (
                            <Badge variant="outline" className="text-xs">
                              Agendada
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {inspection.equipment?.internal_code}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {inspection.profiles?.full_name}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
