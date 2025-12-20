import { useState } from 'react';
import { Filter, Calendar, Ship, FolderOpen, User, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

export interface ReportFilters {
  shipId: string;
  categoryId: string;
  status: string;
  inspectorId: string;
  startDate: string;
  endDate: string;
  groupBy: 'none' | 'ship' | 'category' | 'status' | 'month';
}

interface Ship {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Inspector {
  id: string;
  full_name: string;
}

interface AdvancedReportFiltersProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  ships: Ship[];
  categories: Category[];
  inspectors?: Inspector[];
}

export function AdvancedReportFilters({
  filters,
  onFiltersChange,
  ships,
  categories,
  inspectors = [],
}: AdvancedReportFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const updateFilter = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      shipId: 'all',
      categoryId: 'all',
      status: 'all',
      inspectorId: 'all',
      startDate: '',
      endDate: '',
      groupBy: 'none',
    });
  };

  const activeFiltersCount = [
    filters.shipId !== 'all',
    filters.categoryId !== 'all',
    filters.status !== 'all',
    filters.inspectorId !== 'all',
    filters.startDate !== '',
    filters.endDate !== '',
    filters.groupBy !== 'none',
  ].filter(Boolean).length;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <CardTitle className="text-base">Filtros Avançados</CardTitle>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} ativo(s)
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CardDescription>Configure filtros para gerar relatórios personalizados</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ship Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Ship className="h-3.5 w-3.5" />
                  Embarcação
                </Label>
                <Select value={filters.shipId} onValueChange={(v) => updateFilter('shipId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as embarcações</SelectItem>
                    {ships.map(ship => (
                      <SelectItem key={ship.id} value={ship.id}>{ship.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Categoria
                </Label>
                <Select value={filters.categoryId} onValueChange={(v) => updateFilter('categoryId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="maintenance">Em Manutenção</SelectItem>
                    <SelectItem value="expired">Vencido</SelectItem>
                    <SelectItem value="rejected">Reprovado</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Inspector Filter */}
              {inspectors.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Inspetor
                  </Label>
                  <Select value={filters.inspectorId} onValueChange={(v) => updateFilter('inspectorId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os inspetores</SelectItem>
                      {inspectors.map(insp => (
                        <SelectItem key={insp.id} value={insp.id}>{insp.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Start Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Data Início
                </Label>
                <DatePicker
                  value={filters.startDate}
                  onChange={(v) => updateFilter('startDate', v)}
                  placeholder="Selecione..."
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Data Fim
                </Label>
                <DatePicker
                  value={filters.endDate}
                  onChange={(v) => updateFilter('endDate', v)}
                  placeholder="Selecione..."
                />
              </div>

              {/* Group By */}
              <div className="space-y-2">
                <Label>Agrupar Por</Label>
                <Select value={filters.groupBy} onValueChange={(v) => updateFilter('groupBy', v as ReportFilters['groupBy'])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem agrupamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem agrupamento</SelectItem>
                    <SelectItem value="ship">Embarcação</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="month">Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="space-y-2">
                <Label className="invisible">Ações</Label>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
