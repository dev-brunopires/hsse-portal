import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useShipAreas, useCreateShipArea, useDeleteShipArea } from '@/hooks/useShipAreas';

interface ShipAreasManagerProps {
  /** If provided, manages areas live against this ship. */
  shipId?: string | null;
  /** When no shipId yet (create flow), use draft list. */
  draftAreas?: string[];
  onDraftChange?: (areas: string[]) => void;
}

export function ShipAreasManager({ shipId, draftAreas, onDraftChange }: ShipAreasManagerProps) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const { data: areas = [], isLoading } = useShipAreas(shipId || undefined);
  const createArea = useCreateShipArea();
  const deleteArea = useDeleteShipArea();

  const isDraftMode = !shipId;
  const list = isDraftMode ? (draftAreas || []) : areas.map((a) => a.name);

  const addArea = async () => {
    const value = input.trim();
    if (!value) return;
    if (list.some((n) => n.toLowerCase() === value.toLowerCase())) {
      setInput('');
      return;
    }
    if (isDraftMode) {
      onDraftChange?.([...(draftAreas || []), value]);
      setInput('');
      return;
    }
    try {
      await createArea.mutateAsync({ ship_id: shipId!, name: value });
      setInput('');
    } catch {/* handled */}
  };

  const removeArea = async (name: string) => {
    if (isDraftMode) {
      onDraftChange?.((draftAreas || []).filter((n) => n !== name));
      return;
    }
    const area = areas.find((a) => a.name === name);
    if (!area) return;
    await deleteArea.mutateAsync({ id: area.id, ship_id: shipId! });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addArea();
            }
          }}
          placeholder={t('shipAreas.inputPlaceholder', 'Ex: Convés Principal, Praça de Máquinas...')}
        />
        <Button type="button" onClick={addArea} disabled={!input.trim() || createArea.isPending}>
          {createArea.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading', 'Carregando...')}
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('shipAreas.emptyHelp', 'Nenhuma área cadastrada ainda. Adicione áreas/locais físicos do navio (ex: Convés Principal, Praça de Máquinas, Sala de Bombas).')}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((name) => (
            <Badge
              key={name}
              variant="secondary"
              className="gap-2 pl-2.5 pr-1 py-1 text-sm font-normal"
            >
              <MapPin className="h-3 w-3 text-muted-foreground" />
              {name}
              <button
                type="button"
                onClick={() => removeArea(name)}
                className="ml-1 rounded-sm p-0.5 hover:bg-muted-foreground/10 transition-colors"
                aria-label={t('common.remove', 'Remover')}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
