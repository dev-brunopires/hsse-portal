import { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  useDeleteSafetyObservation,
  useSafetyObservations,
  useUpdateSafetyObservation,
  type SafetyObservation,
  type SafetyObservationWithShip,
  type SafetyRiskLevel,
} from '@/hooks/useSafetyObservations';
import { useToast } from '@/hooks/use-toast';
import { formatDateTime } from '@/utils/dateFormat';
import { downloadSafetyObservationPDF } from '@/utils/safetyObservationPdf';
import { translateOptions, useSafetyObservationText } from '@/utils/safetyObservationText';
import { cn } from '@/lib/utils';

const statusLabel: Record<SafetyObservation['status'], string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  closed: 'Concluída',
};

const riskLabel: Record<SafetyRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const riskClass: Record<SafetyRiskLevel, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-orange-200 bg-orange-50 text-orange-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
};

interface EditState {
  status: SafetyObservation['status'];
  residual_risk_level: SafetyRiskLevel | null;
  recommended_action: string;
  responsible_name: string;
  due_date: string;
  learning: string;
  requires_followup: boolean;
  requires_cmms: boolean;
  requires_investigation: boolean;
  share_in_tbt: boolean;
}

export default function SafetyObservationReports() {
  const tr = useSafetyObservationText();
  const { data: observations = [], isLoading } = useSafetyObservations();
  const updateObservation = useUpdateSafetyObservation();
  const deleteObservation = useDeleteSafetyObservation();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');
  const [template, setTemplate] = useState('all');
  const [viewing, setViewing] = useState<SafetyObservationWithShip | null>(null);
  const [editing, setEditing] = useState<SafetyObservationWithShip | null>(null);
  const [deleting, setDeleting] = useState<SafetyObservationWithShip | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return observations.filter((item) => {
      const matchesSearch = !term || [
        item.description,
        item.area,
        item.observer_name,
        item.observer_department,
        item.ships?.name,
        item.recommended_action,
        item.responsible_name,
      ].some((value) => value?.toLowerCase().includes(term));
      const matchesStatus = status === 'all' || item.status === status;
      const matchesRisk = risk === 'all' || item.risk_level === risk;
      const matchesTemplate = template === 'all' || item.card_template === template;
      return matchesSearch && matchesStatus && matchesRisk && matchesTemplate;
    });
  }, [observations, risk, search, status, template]);

  const counters = useMemo(() => ({
    total: observations.length,
    open: observations.filter((item) => item.status === 'open').length,
    critical: observations.filter((item) => item.risk_level === 'critical' || item.fatality_potential).length,
    followup: observations.filter((item) => item.requires_followup || item.requires_investigation).length,
  }), [observations]);

  const openEdit = (observation: SafetyObservationWithShip) => {
    setEditing(observation);
    setEditState({
      status: observation.status,
      residual_risk_level: observation.residual_risk_level ?? null,
      recommended_action: observation.recommended_action ?? '',
      responsible_name: observation.responsible_name ?? '',
      due_date: observation.due_date ?? '',
      learning: observation.learning ?? '',
      requires_followup: observation.requires_followup,
      requires_cmms: observation.requires_cmms,
      requires_investigation: observation.requires_investigation,
      share_in_tbt: observation.share_in_tbt,
    });
  };

  const saveEdit = async () => {
    if (!editing || !editState) return;
    try {
      await updateObservation.mutateAsync({
        id: editing.id,
        ...editState,
        recommended_action: editState.recommended_action.trim() || null,
        responsible_name: editState.responsible_name.trim() || null,
        due_date: editState.due_date || null,
        learning: editState.learning.trim() || null,
      });
      toast({ title: tr('Observação atualizada'), description: tr('A tratativa foi salva com sucesso.') });
      setEditing(null);
      setEditState(null);
    } catch (error) {
      toast({
        title: tr('Erro ao salvar'),
        description: error instanceof Error ? error.message : tr('Não foi possível atualizar a observação.'),
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteObservation.mutateAsync(deleting.id);
      toast({ title: tr('Observação excluída'), description: tr('O registro foi removido da lista.') });
      setDeleting(null);
    } catch (error) {
      toast({
        title: tr('Erro ao excluir'),
        description: error instanceof Error ? error.message : tr('Não foi possível excluir a observação.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title={tr('Relatórios de Observação de Segurança')}
        description={tr('Registros enviados pelo formulário de observação, com tratativa e exportação.')}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Metric title={tr('Total de registros')} value={counters.total} />
        <Metric title={tr('Abertas')} value={counters.open} tone="blue" />
        <Metric title={tr('Críticas / fatalidade')} value={counters.critical} tone="red" />
        <Metric title={tr('Com acompanhamento')} value={counters.followup} tone="amber" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Filtros')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1fr_180px_180px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr('Buscar por navio, local, observador, descrição ou ação...')}
              className="pl-9"
            />
          </div>
          <FilterSelect label={tr('Status')} value={status} onChange={setStatus} options={translateOptions([
            ['all', 'Todos'],
            ['open', 'Aberta'],
            ['in_progress', 'Em andamento'],
            ['closed', 'Concluída'],
          ], tr)} />
          <FilterSelect label={tr('Risco')} value={risk} onChange={setRisk} options={translateOptions([
            ['all', 'Todos'],
            ['low', 'Baixo'],
            ['medium', 'Médio'],
            ['high', 'Alto'],
            ['critical', 'Crítico'],
          ], tr)} />
          <FilterSelect label={tr('Modelo')} value={template} onChange={setTemplate} options={translateOptions([
            ['all', 'Todos'],
            ['bco', 'Comportamento / Condição'],
            ['psf', 'Segurança de Processo'],
          ], tr)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tr('Registros')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tr('Carregando observações...')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
              {tr('Nenhuma observação encontrada.')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{tr('Data')}</TableHead>
                  <TableHead>{tr('Navio / local')}</TableHead>
                  <TableHead>{tr('Descrição')}</TableHead>
                  <TableHead>{tr('Risco')}</TableHead>
                  <TableHead>{tr('Status')}</TableHead>
                  <TableHead className="text-right">{tr('Ações')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="whitespace-nowrap">{formatDateTime(item.observed_at)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{item.ships?.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{item.area}</div>
                    </TableCell>
                    <TableCell className="max-w-xl">
                      <div className="line-clamp-2">{item.description}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.observer_name || item.observer_department || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('border', riskClass[item.risk_level])}>
                        {tr(riskLabel[item.risk_level])}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'closed' ? 'default' : 'secondary'}>
                        {tr(statusLabel[item.status])}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <IconAction label={tr('Visualizar')} icon={Eye} onClick={() => setViewing(item)} />
                        <IconAction label={tr('Editar tratativa')} icon={Pencil} onClick={() => openEdit(item)} />
                        <IconAction label={tr('Baixar PDF')} icon={Download} onClick={() => downloadSafetyObservationPDF(item)} />
                        <IconAction label={tr('Excluir')} icon={Trash2} onClick={() => setDeleting(item)} destructive />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ObservationDialog observation={viewing} onOpenChange={(open) => !open && setViewing(null)} />

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{tr('Editar tratativa')}</DialogTitle>
            <DialogDescription>{tr('Atualize o status, responsável, prazo e ações de acompanhamento.')}</DialogDescription>
          </DialogHeader>
          {editState && (
            <div className="grid gap-4 py-2 md:grid-cols-2">
              <EditSelect label={tr('Status')} value={editState.status} onChange={(value) => setEditState({ ...editState, status: value as SafetyObservation['status'] })} options={translateOptions([
                ['open', 'Aberta'],
                ['in_progress', 'Em andamento'],
                ['closed', 'Concluída'],
              ], tr)} />
              <EditSelect label={tr('Risco residual')} value={editState.residual_risk_level ?? 'none'} onChange={(value) => setEditState({ ...editState, residual_risk_level: value === 'none' ? null : value as SafetyRiskLevel })} options={translateOptions([
                ['none', 'Não informado'],
                ['low', 'Baixo'],
                ['medium', 'Médio'],
                ['high', 'Alto'],
                ['critical', 'Crítico'],
              ], tr)} />
              <div className="space-y-2">
                <Label>{tr('Responsável')}</Label>
                <Input value={editState.responsible_name} onChange={(event) => setEditState({ ...editState, responsible_name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{tr('Prazo')}</Label>
                <Input type="date" value={editState.due_date} onChange={(event) => setEditState({ ...editState, due_date: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tr('Ação recomendada')}</Label>
                <Textarea rows={3} value={editState.recommended_action} onChange={(event) => setEditState({ ...editState, recommended_action: event.target.value })} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{tr('Aprendizado')}</Label>
                <Textarea rows={3} value={editState.learning} onChange={(event) => setEditState({ ...editState, learning: event.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{tr('Cancelar')}</Button>
            <Button onClick={saveEdit} disabled={updateObservation.isPending}>
              {updateObservation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr('Salvar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('Excluir observação?')}</DialogTitle>
            <DialogDescription>{tr('Essa ação remove o registro da base. Use apenas para duplicidades ou lançamentos incorretos.')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{tr('Cancelar')}</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteObservation.isPending}>
              {deleteObservation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tr('Excluir')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ title, value, tone = 'default' }: { title: string; value: number; tone?: 'default' | 'blue' | 'red' | 'amber' }) {
  return (
    <Card className={cn(
      tone === 'blue' && 'border-l-4 border-l-blue-500',
      tone === 'red' && 'border-l-4 border-l-red-500',
      tone === 'amber' && 'border-l-4 border-l-amber-500',
    )}>
      <CardContent className="py-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>{optionLabel}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EditSelect({ label, value, options, onChange }: { label: string; value: string; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <FilterSelect label={label} value={value} options={options} onChange={onChange} />
    </div>
  );
}

function IconAction({ label, icon: Icon, onClick, destructive = false }: { label: string; icon: typeof Eye; onClick: () => void; destructive?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClick}
          aria-label={label}
          className={destructive ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function ObservationDialog({ observation, onOpenChange }: { observation: SafetyObservationWithShip | null; onOpenChange: (open: boolean) => void }) {
  const tr = useSafetyObservationText();
  return (
    <Dialog open={!!observation} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{tr('Detalhes da observação')}</DialogTitle>
          <DialogDescription>{tr('Registro completo enviado pelo formulário de observação de segurança.')}</DialogDescription>
        </DialogHeader>
        {observation && (
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <Detail label={tr('Navio')} value={observation.ships?.name || '-'} />
            <Detail label={tr('Localização')} value={observation.area} />
            <Detail label={tr('Data e hora')} value={formatDateTime(observation.observed_at)} />
            <Detail label={tr('Modelo')} value={observation.card_template === 'psf' ? tr('Segurança de Processo') : tr('Comportamento / Condição')} />
            <Detail label={tr('Observador')} value={observation.observer_name || '-'} />
            <Detail label={tr('Departamento')} value={observation.observer_department || '-'} />
            <Detail label={tr('Descrição')} value={observation.description} full />
            <Detail label={tr('Percepção de risco')} value={observation.risk_perception} full />
            <Detail label={tr('Ação imediata')} value={observation.immediate_action} full />
            <Detail label={tr('Ação recomendada')} value={observation.recommended_action || '-'} full />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, full = false }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={cn(full && 'md:col-span-2')}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}
