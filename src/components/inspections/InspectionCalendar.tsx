import { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, XCircle, Clock, CalendarDays, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/utils/dateFormat';
import type { InspectionWithDetails } from '@/hooks/useInspections';

interface InspectionCalendarProps {
  inspections: InspectionWithDetails[];
  onInspectionClick: (inspection: InspectionWithDetails) => void;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: typeof CheckCircle }> = {
  compliant: { 
    label: 'Conforme', 
    color: 'text-emerald-600 dark:text-emerald-400', 
    bgColor: 'bg-emerald-500', 
    borderColor: 'border-emerald-500/30',
    icon: CheckCircle 
  },
  attention: { 
    label: 'Atenção', 
    color: 'text-amber-600 dark:text-amber-400', 
    bgColor: 'bg-amber-500', 
    borderColor: 'border-amber-500/30',
    icon: AlertTriangle 
  },
  'non-compliant': { 
    label: 'Não Conforme', 
    color: 'text-red-600 dark:text-red-400', 
    bgColor: 'bg-red-500', 
    borderColor: 'border-red-500/30',
    icon: XCircle 
  },
  pending: { 
    label: 'Pendente', 
    color: 'text-slate-600 dark:text-slate-400', 
    bgColor: 'bg-slate-400', 
    borderColor: 'border-slate-400/30',
    icon: Clock 
  },
};

export function InspectionCalendar({ inspections, onInspectionClick }: InspectionCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dayDialogOpen, setDayDialogOpen] = useState(false);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  // Use weekStartsOn: 0 to start weeks on Sunday, matching our weekDays array
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group inspections by date - using parseLocalDate to avoid timezone issues
  const inspectionsByDate = useMemo(() => {
    const grouped = new Map<string, InspectionWithDetails[]>();
    
    inspections.forEach(inspection => {
      // The inspection_date is already in 'YYYY-MM-DD' format from the database
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
    // Format the local date to YYYY-MM-DD without timezone conversion
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
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
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-semibold capitalize">
                  {format(currentMonth, 'MMMM', { locale: ptBR })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {format(currentMonth, 'yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-primary/10"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-lg font-medium hidden sm:flex"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoje
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-primary/10"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Content */}
        <div className="p-3 sm:p-5">
          {/* Week days header */}
          <div className="grid grid-cols-7 mb-3">
            {weekDays.map((day, index) => (
              <div
                key={day}
                className={cn(
                  "text-center text-xs sm:text-sm font-semibold py-2 sm:py-3",
                  index === 0 || index === 6 
                    ? "text-muted-foreground/60" 
                    : "text-muted-foreground"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((day, index) => {
              const dayInspections = getInspectionsForDay(day);
              const dayStatus = getDayStatus(dayInspections);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isTodayDate = isToday(day);
              const isWeekend = index % 7 === 0 || index % 7 === 6;
              const statusStyle = dayStatus ? statusConfig[dayStatus] : null;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  disabled={dayInspections.length === 0}
                  className={cn(
                    "relative aspect-square sm:aspect-[4/3] p-1 sm:p-2 rounded-lg transition-all duration-200 group",
                    "flex flex-col items-center justify-start",
                    // Base styles
                    isCurrentMonth 
                      ? "bg-background hover:bg-accent/50" 
                      : "bg-muted/20 text-muted-foreground/40",
                    // Weekend styling
                    isWeekend && isCurrentMonth && "bg-muted/30",
                    // Today styling
                    isTodayDate && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    // Has inspections
                    dayInspections.length > 0 && [
                      "cursor-pointer border-2",
                      statusStyle?.borderColor,
                      "hover:shadow-md hover:scale-[1.02]"
                    ],
                    dayInspections.length === 0 && "cursor-default border border-transparent"
                  )}
                >
                  {/* Day number */}
                  <span className={cn(
                    "text-xs sm:text-sm font-medium leading-none mt-0.5 sm:mt-1",
                    isTodayDate && "bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] sm:text-xs font-bold",
                    !isCurrentMonth && "opacity-40"
                  )}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Inspection indicators */}
                  {dayInspections.length > 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center w-full mt-1">
                      {dayInspections.length === 1 ? (
                        <div className={cn(
                          "w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full",
                          statusStyle?.bgColor
                        )} />
                      ) : dayInspections.length <= 3 ? (
                        <div className="flex gap-0.5 flex-wrap justify-center">
                          {dayInspections.map((insp, i) => {
                            const inspStatus = statusConfig[insp.status] || statusConfig.pending;
                            return (
                              <div
                                key={i}
                                className={cn(
                                  "w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full",
                                  inspStatus.bgColor
                                )}
                              />
                            );
                          })}
                        </div>
                      ) : (
                        <div className={cn(
                          "flex items-center justify-center",
                          "text-[10px] sm:text-xs font-bold",
                          "w-5 h-5 sm:w-6 sm:h-6 rounded-full",
                          statusStyle?.bgColor,
                          "text-white shadow-sm"
                        )}>
                          {dayInspections.length}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hover overlay for days with inspections */}
                  {dayInspections.length > 0 && (
                    <div className="absolute inset-0 rounded-lg bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-5 pt-5 border-t">
            {Object.entries(statusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div className={cn(
                  "w-3 h-3 rounded-full shadow-sm",
                  config.bgColor
                )} />
                <span className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {config.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Details Dialog */}
      <Dialog open={dayDialogOpen} onOpenChange={setDayDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span>
                {selectedDate && format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              {selectedDateInspections.length} inspeção(ões) neste dia
            </p>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3 py-2">
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
                    className={cn(
                      "w-full p-4 rounded-xl border-2 transition-all duration-200 text-left group",
                      "hover:shadow-lg hover:scale-[1.01] hover:border-primary/30",
                      "bg-gradient-to-r from-card to-card/80",
                      config.borderColor
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "p-2.5 rounded-xl shrink-0",
                        config.bgColor + '/15'
                      )}>
                        <Icon className={cn("h-5 w-5", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold truncate text-foreground">
                            {inspection.equipment?.name || 'Equipamento'}
                          </p>
                          {isUpcoming && (
                            <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                              Agendada
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">
                          {inspection.equipment?.internal_code}
                        </p>
                        <div className="flex items-center gap-3 mt-2.5">
                          <Badge 
                            className={cn(
                              "text-xs font-medium",
                              config.bgColor,
                              "text-white border-0"
                            )}
                          >
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
                            {inspection.profiles?.full_name}
                          </span>
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="h-5 w-5 text-muted-foreground" />
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
