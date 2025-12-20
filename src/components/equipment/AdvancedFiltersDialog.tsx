import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
            Filtros Avançados
            {activeFiltersCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                {activeFiltersCount} ativo(s)
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fabricante</Label>
              <Select 
                value={localFilters.manufacturer} 
                onValueChange={(v) => setLocalFilters(f => ({ ...f, manufacturer: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {manufacturers.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select 
                value={localFilters.category} 
                onValueChange={(v) => setLocalFilters(f => ({ ...f, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {categories?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select 
              value={localFilters.unit} 
              onValueChange={(v) => setLocalFilters(f => ({ ...f, unit: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {units.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data de Aquisição</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={localFilters.acquisitionDateFrom}
                onChange={(e) => setLocalFilters(f => ({ ...f, acquisitionDateFrom: e.target.value }))}
                placeholder="De"
              />
              <Input
                type="date"
                value={localFilters.acquisitionDateTo}
                onChange={(e) => setLocalFilters(f => ({ ...f, acquisitionDateTo: e.target.value }))}
                placeholder="Até"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Validade do Equipamento</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={localFilters.expiryDateFrom}
                onChange={(e) => setLocalFilters(f => ({ ...f, expiryDateFrom: e.target.value }))}
                placeholder="De"
              />
              <Input
                type="date"
                value={localFilters.expiryDateTo}
                onChange={(e) => setLocalFilters(f => ({ ...f, expiryDateTo: e.target.value }))}
                placeholder="Até"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Validade do Certificado</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={localFilters.certificateExpiryFrom}
                onChange={(e) => setLocalFilters(f => ({ ...f, certificateExpiryFrom: e.target.value }))}
                placeholder="De"
              />
              <Input
                type="date"
                value={localFilters.certificateExpiryTo}
                onChange={(e) => setLocalFilters(f => ({ ...f, certificateExpiryTo: e.target.value }))}
                placeholder="Até"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={handleClear} className="gap-2">
            <X className="h-4 w-4" />
            Limpar Filtros
          </Button>
          <Button onClick={handleApply}>Aplicar Filtros</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
