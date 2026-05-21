import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, MapPin, Loader2, Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const downloadTemplate = () => {
    const data = [
      { [t('shipAreas.columnName', 'Área / Local')]: t('shipAreas.exampleArea1', 'Convés Principal') },
      { [t('shipAreas.columnName', 'Área / Local')]: t('shipAreas.exampleArea2', 'Praça de Máquinas') },
      { [t('shipAreas.columnName', 'Área / Local')]: t('shipAreas.exampleArea3', 'Sala de Bombas') },
    ];
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Areas');
    XLSX.writeFile(wb, 'template_areas_navio.xlsx');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      const names: string[] = [];
      const seen = new Set(list.map((n) => n.toLowerCase()));
      // Skip header row, take first column
      for (let i = 1; i < rows.length; i++) {
        const cell = rows[i]?.[0];
        if (cell == null) continue;
        const value = String(cell).trim();
        if (!value) continue;
        const key = value.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        names.push(value);
      }

      if (names.length === 0) {
        toast({
          title: t('shipAreas.importEmpty', 'Nenhuma área encontrada'),
          description: t('shipAreas.importEmptyDesc', 'O arquivo não contém áreas novas para importar.'),
          variant: 'destructive',
        });
        return;
      }

      if (isDraftMode) {
        onDraftChange?.([...(draftAreas || []), ...names]);
      } else {
        const results = await Promise.allSettled(
          names.map((name) => createArea.mutateAsync({ ship_id: shipId!, name }))
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) {
          toast({
            title: t('shipAreas.importPartial', 'Importação parcial'),
            description: t('shipAreas.importPartialDesc', '{{ok}} criadas, {{failed}} falharam.', {
              ok: names.length - failed,
              failed,
            }),
          });
        }
      }

      toast({
        title: t('shipAreas.importSuccess', 'Áreas importadas'),
        description: t('shipAreas.importSuccessDesc', '{{count}} área(s) adicionada(s).', { count: names.length }),
      });
    } catch (err) {
      toast({
        title: t('common.error', 'Erro'),
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="gap-2"
        >
          <Download className="h-3.5 w-3.5" />
          {t('shipAreas.downloadTemplate', 'Baixar modelo Excel')}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="gap-2"
        >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {t('shipAreas.importExcel', 'Importar Excel')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileChange}
        />
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
