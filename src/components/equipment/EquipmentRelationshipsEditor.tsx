import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EquipmentCombobox } from './EquipmentCombobox';
import {
  useEquipmentRelationships,
  useCreateEquipmentRelationship,
  useDeleteEquipmentRelationship,
  type RelationshipType,
} from '@/hooks/useEquipmentRelationships';

interface Props {
  equipmentId: string;
}

const RELATIONSHIP_TYPES: { value: RelationshipType; labelKey: string; defaultLabel: string }[] = [
  { value: 'component', labelKey: 'relationship.types.component', defaultLabel: 'Componente' },
  { value: 'hose', labelKey: 'relationship.types.hose', defaultLabel: 'Mangueira' },
  { value: 'nozzle', labelKey: 'relationship.types.nozzle', defaultLabel: 'Esguicho' },
  { value: 'accessory', labelKey: 'relationship.types.accessory', defaultLabel: 'Acessório' },
  { value: 'spare', labelKey: 'relationship.types.spare', defaultLabel: 'Sobressalente' },
  { value: 'connected_to', labelKey: 'relationship.types.connected_to', defaultLabel: 'Conectado a' },
  { value: 'other', labelKey: 'relationship.types.other', defaultLabel: 'Outro' },
];

export function EquipmentRelationshipsEditor({ equipmentId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useEquipmentRelationships(equipmentId);
  const createRel = useCreateEquipmentRelationship();
  const deleteRel = useDeleteEquipmentRelationship();

  const [childId, setChildId] = useState('');
  const [type, setType] = useState<RelationshipType>('component');
  const [notes, setNotes] = useState('');

  const handleAdd = async () => {
    if (!childId) return;
    await createRel.mutateAsync({
      parent_equipment_id: equipmentId,
      child_equipment_id: childId,
      relationship_type: type,
      notes: notes || null,
    });
    setChildId('');
    setNotes('');
    setType('component');
  };

  const labelFor = (val: string) => {
    const m = RELATIONSHIP_TYPES.find((r) => r.value === val);
    return m ? t(m.labelKey, m.defaultLabel) : val;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4 space-y-3">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          {t('relationship.addNew', 'Adicionar vínculo')}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('relationship.equipment', 'Equipamento vinculado')}</Label>
            <EquipmentCombobox
              value={childId}
              onChange={setChildId}
              filter={(e) => e.id !== equipmentId}
              placeholder={t('relationship.searchEquipment', 'Buscar equipamento...')}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('relationship.type', 'Tipo de vínculo')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as RelationshipType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.labelKey, r.defaultLabel)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('relationship.notes', 'Observações (opcional)')}</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!childId || createRel.isPending}
            className="gap-2"
          >
            {createRel.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {t('relationship.add', 'Adicionar')}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          {t('relationship.linked', 'Equipamentos vinculados')}
        </h4>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {(data?.asParent.length ?? 0) === 0 && (data?.asChild.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                {t('relationship.empty', 'Nenhum vínculo cadastrado.')}
              </p>
            ) : (
              <div className="space-y-2">
                {data?.asParent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/30"
                  >
                    <Badge variant="secondary">{labelFor(r.relationship_type)}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.child?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.child?.internal_code}
                        {r.child?.short_code ? ` • #${r.child.short_code}` : ''}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteRel.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {data?.asChild.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/10"
                  >
                    <Badge variant="outline">
                      {t('relationship.parentOf', 'Faz parte de')} • {labelFor(r.relationship_type)}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.parent?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.parent?.internal_code}
                        {r.parent?.short_code ? ` • #${r.parent.short_code}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
