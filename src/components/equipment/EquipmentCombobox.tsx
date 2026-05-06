import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';

interface EquipmentComboboxProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Optional filter (e.g. exclude an id, or limit to a ship) */
  filter?: (e: EquipmentWithCategory) => boolean;
  /** Optional pre-loaded list (avoids re-fetching) */
  equipmentList?: EquipmentWithCategory[];
  className?: string;
}

export function EquipmentCombobox({
  value,
  onChange,
  placeholder,
  disabled,
  filter,
  equipmentList,
  className,
}: EquipmentComboboxProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: fetched = [], isLoading } = useEquipment();
  const list = equipmentList ?? fetched;

  const items = useMemo(() => {
    return (filter ? list.filter(filter) : list).slice().sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );
  }, [list, filter]);

  const selected = items.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate text-left">
            {selected
              ? `${selected.name} • ${selected.internal_code}`
              : placeholder ?? t('common.selectEquipment', 'Selecionar equipamento')}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder={t('common.searchByNameCodeOrShortCode', 'Buscar por nome, código ou short code...')}
          />
          <CommandList>
            <CommandEmpty>{t('common.noResults', 'Nenhum resultado')}</CommandEmpty>
            <CommandGroup>
              {items.map((eq) => {
                const haystack = `${eq.name} ${eq.internal_code} ${eq.short_code ?? ''} ${eq.serial_number ?? ''}`;
                return (
                  <CommandItem
                    key={eq.id}
                    value={haystack}
                    onSelect={() => {
                      onChange(eq.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('mr-2 h-4 w-4', value === eq.id ? 'opacity-100' : 'opacity-0')}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{eq.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {eq.internal_code}
                        {eq.short_code ? ` • #${eq.short_code}` : ''}
                        {eq.location ? ` • ${eq.location}` : ''}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
