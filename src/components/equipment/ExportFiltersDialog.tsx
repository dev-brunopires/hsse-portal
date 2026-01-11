import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileText, Eye, Filter, X } from 'lucide-react';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { useCategories } from '@/hooks/useCategories';
import { useShips } from '@/hooks/useShips';

export interface ExportFilters {
  categoryId: string;
  shipId: string;
  status: string;
}

interface ExportFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: EquipmentWithCategory[];
  onExport: (filteredEquipment: EquipmentWithCategory[], preview: boolean) => void;
}

export function ExportFiltersDialog({
  open,
  onOpenChange,
  equipment,
  onExport,
}: ExportFiltersDialogProps) {
  const { t } = useTranslation();
  const { data: categories = [] } = useCategories();
  const { data: ships = [] } = useShips();

  const [filters, setFilters] = useState<ExportFilters>({
    categoryId: 'all',
    shipId: 'all',
    status: 'all',
  });

  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      if (filters.categoryId !== 'all' && item.category_id !== filters.categoryId) {
        return false;
      }
      if (filters.shipId !== 'all' && item.ship_id !== filters.shipId) {
        return false;
      }
      if (filters.status !== 'all' && item.status !== filters.status) {
        return false;
      }
      return true;
    });
  }, [equipment, filters]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.categoryId !== 'all') count++;
    if (filters.shipId !== 'all') count++;
    if (filters.status !== 'all') count++;
    return count;
  }, [filters]);

  const handleClearFilters = () => {
    setFilters({
      categoryId: 'all',
      shipId: 'all',
      status: 'all',
    });
  };

  const handleExport = (preview: boolean) => {
    onExport(filteredEquipment, preview);
    onOpenChange(false);
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || categoryId;
  };

  const getShipName = (shipId: string) => {
    const ship = ships.find(s => s.id === shipId);
    return ship?.name || shipId;
  };

  const statusLabels: Record<string, string> = {
    active: t('equipmentTable.statusActive'),
    maintenance: t('equipmentTable.statusMaintenance'),
    expired: t('equipmentTable.statusExpired'),
    rejected: t('equipmentTable.statusRejected'),
    inactive: t('equipmentTable.statusInactive'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {t('exportFilters.title')}
          </DialogTitle>
          <DialogDescription>
            {t('exportFilters.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Category Filter */}
          <div className="space-y-2">
            <Label>{t('exportFilters.category')}</Label>
            <Select
              value={filters.categoryId}
              onValueChange={(value) => setFilters(prev => ({ ...prev, categoryId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('exportFilters.allCategories')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('exportFilters.allCategories')}</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ship Filter */}
          <div className="space-y-2">
            <Label>{t('exportFilters.ship')}</Label>
            <Select
              value={filters.shipId}
              onValueChange={(value) => setFilters(prev => ({ ...prev, shipId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('exportFilters.allShips')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('exportFilters.allShips')}</SelectItem>
                {ships.map((ship) => (
                  <SelectItem key={ship.id} value={ship.id}>
                    {ship.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-2">
            <Label>{t('exportFilters.status')}</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('exportFilters.allStatuses')} />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">{t('exportFilters.allStatuses')}</SelectItem>
                <SelectItem value="active">{statusLabels.active}</SelectItem>
                <SelectItem value="maintenance">{statusLabels.maintenance}</SelectItem>
                <SelectItem value="expired">{statusLabels.expired}</SelectItem>
                <SelectItem value="rejected">{statusLabels.rejected}</SelectItem>
                <SelectItem value="inactive">{statusLabels.inactive}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Active Filters Summary */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t">
              <span className="text-sm text-muted-foreground">{t('exportFilters.activeFilters')}:</span>
              {filters.categoryId !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {getCategoryName(filters.categoryId)}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, categoryId: 'all' }))}
                  />
                </Badge>
              )}
              {filters.shipId !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {getShipName(filters.shipId)}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, shipId: 'all' }))}
                  />
                </Badge>
              )}
              {filters.status !== 'all' && (
                <Badge variant="secondary" className="gap-1">
                  {statusLabels[filters.status]}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                  />
                </Badge>
              )}
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-6 text-xs">
                {t('exportFilters.clearAll')}
              </Button>
            </div>
          )}

          {/* Results Preview */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-primary">{filteredEquipment.length}</p>
            <p className="text-sm text-muted-foreground">
              {t('exportFilters.equipmentToExport', { count: filteredEquipment.length })}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport(true)}
            disabled={filteredEquipment.length === 0}
            className="gap-2"
          >
            <Eye className="h-4 w-4" />
            {t('exportFilters.preview')}
          </Button>
          <Button 
            onClick={() => handleExport(false)}
            disabled={filteredEquipment.length === 0}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            {t('exportFilters.exportPDF')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
