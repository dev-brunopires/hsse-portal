import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useTranslation } from 'react-i18next';

export interface AdvancedFilters {
  manufacturer: string;
  category: string;
  unit: string;
  acquisitionDateFrom: string;
  acquisitionDateTo: string;
  expiryDateFrom: string;
  expiryDateTo: string;
  certificateExpiryFrom: string;
  certificateExpiryTo: string;
}

interface AdvancedFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AdvancedFilters;
  onApply: (filters: AdvancedFilters) => void;
  manufacturers: string[];
  units: string[];
}

const emptyFilters: AdvancedFilters = {
  manufacturer: '',
  category: '',
  unit: '',
  acquisitionDateFrom: '',
  acquisitionDateTo: '',
  expiryDateFrom: '',
  expiryDateTo: '',
  certificateExpiryFrom: '',
  certificateExpiryTo: '',
};

export function AdvancedFiltersDialog({ 
  open, 
  onOpenChange, 
  filters, 
  onApply,
  manufacturers,
  units,
}: AdvancedFiltersDialogProps) {
  const { t } = useTranslation();
  const [localFilters, setLocalFilters] = useState<AdvancedFilters>(filters);
  const { data: categories } = useCategories();

  const handleApply = () => {
    onApply(localFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    setLocalFilters(emptyFilters);
    onApply(emptyFilters);
    onOpenChange(false);
  };

  const activeFiltersCount = Object.values(localFilters).filter(v => v !== '').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            {t('advancedFilters.title')}
            {activeFiltersCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                {t('advancedFilters.activeCount', { count: activeFiltersCount })}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('advancedFilters.manufacturer')}</Label>
              <Select 
                value={localFilters.manufacturer || "all"} 
                onValueChange={(v) => setLocalFilters(f => ({ ...f, manufacturer: v === "all" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('advancedFilters.allManufacturers')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('advancedFilters.allManufacturers')}</SelectItem>
                  {manufacturers.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('advancedFilters.category')}</Label>
              <Select 
                value={localFilters.category || "all"} 
                onValueChange={(v) => setLocalFilters(f => ({ ...f, category: v === "all" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('advancedFilters.allCategories')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('advancedFilters.allCategories')}</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('advancedFilters.unit')}</Label>
            <Select 
              value={localFilters.unit || "all"} 
              onValueChange={(v) => setLocalFilters(f => ({ ...f, unit: v === "all" ? "" : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('advancedFilters.allUnits')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('advancedFilters.allUnits')}</SelectItem>
                {units.filter(u => u).map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('advancedFilters.acquisitionDate')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                value={localFilters.acquisitionDateFrom}
                onChange={(v) => setLocalFilters(f => ({ ...f, acquisitionDateFrom: v }))}
                placeholder={t('advancedFilters.from')}
                fromYear={1990}
                toYear={new Date().getFullYear() + 1}
              />
              <DatePicker
                value={localFilters.acquisitionDateTo}
                onChange={(v) => setLocalFilters(f => ({ ...f, acquisitionDateTo: v }))}
                placeholder={t('advancedFilters.to')}
                fromYear={1990}
                toYear={new Date().getFullYear() + 1}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('advancedFilters.equipmentExpiry')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                value={localFilters.expiryDateFrom}
                onChange={(v) => setLocalFilters(f => ({ ...f, expiryDateFrom: v }))}
                placeholder={t('advancedFilters.from')}
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 30}
              />
              <DatePicker
                value={localFilters.expiryDateTo}
                onChange={(v) => setLocalFilters(f => ({ ...f, expiryDateTo: v }))}
                placeholder={t('advancedFilters.to')}
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 30}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('advancedFilters.certificateExpiry')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <DatePicker
                value={localFilters.certificateExpiryFrom}
                onChange={(v) => setLocalFilters(f => ({ ...f, certificateExpiryFrom: v }))}
                placeholder={t('advancedFilters.from')}
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 30}
              />
              <DatePicker
                value={localFilters.certificateExpiryTo}
                onChange={(v) => setLocalFilters(f => ({ ...f, certificateExpiryTo: v }))}
                placeholder={t('advancedFilters.to')}
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 30}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClear} className="gap-2">
            <X className="h-4 w-4" />
            {t('advancedFilters.clearFilters')}
          </Button>
          <Button onClick={handleApply}>{t('advancedFilters.applyFilters')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
