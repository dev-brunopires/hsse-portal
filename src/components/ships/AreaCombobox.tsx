import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Plus, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useShipAreas, useCreateShipArea } from '@/hooks/useShipAreas';

interface AreaComboboxProps {
  shipId?: string | null;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function AreaCombobox({
  shipId, value, onChange, placeholder, disabled, className,
}: AreaComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: areas = [], isLoading } = useShipAreas(shipId);
  const createArea = useCreateShipArea();

  const trimmed = query.trim();
  const existingMatch = useMemo(
    () => areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase()),
    [areas, trimmed]
  );

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  const handleCreate = async () => {
    if (!shipId || !trimmed) return;
    try {
      const area = await createArea.mutateAsync({ ship_id: shipId, name: trimmed });
      handleSelect(area.name);
    } catch {
      // already handled
    }
  };

  return (
    <Popover open={open} onOpenChange={(o) => { if (!disabled) setOpen(o); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="flex items-center gap-2 truncate">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">
              {value || placeholder || t('shipAreas.selectPlaceholder', 'Selecione ou crie uma área')}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 bg-popover z-50" align="start">
        <Command shouldFilter>
          <CommandInput
            placeholder={t('shipAreas.searchPlaceholder', 'Buscar área...')}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {!shipId ? (
              <CommandEmpty>{t('shipAreas.selectShipFirst', 'Selecione um navio primeiro')}</CommandEmpty>
            ) : isLoading ? (
              <CommandEmpty>{t('common.loading', 'Carregando...')}</CommandEmpty>
            ) : areas.length === 0 && !trimmed ? (
              <CommandEmpty>{t('shipAreas.empty', 'Nenhuma área cadastrada. Digite para criar.')}</CommandEmpty>
            ) : (
              <CommandEmpty>{t('shipAreas.noMatch', 'Nenhuma área encontrada.')}</CommandEmpty>
            )}

            {areas.length > 0 && (
              <CommandGroup heading={t('shipAreas.existing', 'Áreas cadastradas')}>
                {areas.map((area) => (
                  <CommandItem
                    key={area.id}
                    value={area.name}
                    onSelect={() => handleSelect(area.name)}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === area.name ? 'opacity-100' : 'opacity-0')} />
                    {area.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {shipId && trimmed && !existingMatch && (
              <CommandGroup heading={t('shipAreas.create', 'Criar nova')}>
                <CommandItem
                  value={`__create__${trimmed}`}
                  onSelect={handleCreate}
                  disabled={createArea.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('shipAreas.createOption', 'Criar')} "<span className="font-medium">{trimmed}</span>"
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
