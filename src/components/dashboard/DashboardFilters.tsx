import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Filter, X, CalendarDays, Ship, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Ship as ShipType } from '@/hooks/useShips';

export interface DashboardFiltersState {
  shipId: string;
  categoryId: string;
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onFiltersChange: (filters: DashboardFiltersState) => void;
  ships: ShipType[];
  categories: { id: string; name: string }[];
}

export function DashboardFilters({ 
  filters, 
  onFiltersChange, 
  ships, 
  categories 
}: DashboardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = 
    filters.shipId !== 'all' || 
    filters.categoryId !== 'all' || 
    filters.startDate || 
    filters.endDate;

  const activeFilterCount = [
    filters.shipId !== 'all',
    filters.categoryId !== 'all',
    filters.startDate && filters.endDate,
  ].filter(Boolean).length;

  const clearFilters = () => {
    onFiltersChange({
      shipId: 'all',
      categoryId: 'all',
      startDate: undefined,
      endDate: undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={isExpanded ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filtros
          {activeFilterCount > 0 && (
            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="flex flex-wrap gap-3 p-4 bg-muted/30 rounded-xl border animate-fade-in">
          {/* Ship Filter */}
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filters.shipId}
              onValueChange={(value) => onFiltersChange({ ...filters, shipId: value })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Todos os navios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os navios</SelectItem>
                {ships.map((ship) => (
                  <SelectItem key={ship.id} value={ship.id}>
                    {ship.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filters.categoryId}
              onValueChange={(value) => onFiltersChange({ ...filters, categoryId: value })}
            >
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Todas categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-9 justify-start text-left font-normal min-w-[200px]",
                    !filters.startDate && "text-muted-foreground"
                  )}
                >
                  {filters.startDate && filters.endDate ? (
                    <>
                      {format(filters.startDate, 'dd/MM/yy')} - {format(filters.endDate, 'dd/MM/yy')}
                    </>
                  ) : (
                    "Selecionar período"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={filters.startDate}
                  selected={{
                    from: filters.startDate,
                    to: filters.endDate,
                  }}
                  onSelect={(range) => {
                    onFiltersChange({
                      ...filters,
                      startDate: range?.from,
                      endDate: range?.to,
                    });
                  }}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}
    </div>
  );
}
