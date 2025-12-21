import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface ShipType {
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
  ships: ShipType[];
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
  const { t } = useTranslation();
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
                <CardTitle className="text-base">{t('reports.advancedFilters')}</CardTitle>
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFiltersCount} {t('reports.activeFilters')}
                  </Badge>
                )}
              </div>
              <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CollapsibleTrigger>
          <CardDescription>{t('reports.configureFilters')}</CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ship Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Ship className="h-3.5 w-3.5" />
                  {t('reports.ship')}
                </Label>
                <Select value={filters.shipId} onValueChange={(v) => updateFilter('shipId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.allShips')}</SelectItem>
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
                  {t('common.category')}
                </Label>
                <Select value={filters.categoryId} onValueChange={(v) => updateFilter('categoryId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.allCategories')}</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <Select value={filters.status} onValueChange={(v) => updateFilter('status', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('common.all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('reports.allStatus')}</SelectItem>
                    <SelectItem value="active">{t('reports.statusActive')}</SelectItem>
                    <SelectItem value="maintenance">{t('reports.statusMaintenance')}</SelectItem>
                    <SelectItem value="expired">{t('reports.statusExpired')}</SelectItem>
                    <SelectItem value="rejected">{t('reports.statusRejected')}</SelectItem>
                    <SelectItem value="inactive">{t('reports.statusInactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Inspector Filter */}
              {inspectors.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    {t('reports.inspector')}
                  </Label>
                  <Select value={filters.inspectorId} onValueChange={(v) => updateFilter('inspectorId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('common.all')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('reports.allInspectors')}</SelectItem>
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
                  {t('reports.startDate')}
                </Label>
                <DatePicker
                  value={filters.startDate}
                  onChange={(v) => updateFilter('startDate', v)}
                  placeholder={t('common.selectOption')}
                />
              </div>

              {/* End Date */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {t('reports.endDate')}
                </Label>
                <DatePicker
                  value={filters.endDate}
                  onChange={(v) => updateFilter('endDate', v)}
                  placeholder={t('common.selectOption')}
                />
              </div>

              {/* Group By */}
              <div className="space-y-2">
                <Label>{t('reports.groupBy')}</Label>
                <Select value={filters.groupBy} onValueChange={(v) => updateFilter('groupBy', v as ReportFilters['groupBy'])}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('reports.noGrouping')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('reports.noGrouping')}</SelectItem>
                    <SelectItem value="ship">{t('reports.byShip')}</SelectItem>
                    <SelectItem value="category">{t('reports.byCategory')}</SelectItem>
                    <SelectItem value="status">{t('reports.byStatus')}</SelectItem>
                    <SelectItem value="month">{t('reports.byMonth')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              <div className="space-y-2">
                <Label className="invisible">{t('reports.actions')}</Label>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={clearFilters}
                  disabled={activeFiltersCount === 0}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {t('reports.clearFilters')}
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
