import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { translateError } from '@/utils/errorTranslation';
import { useAuth } from '@/contexts/AuthContext';

export type RelationshipType =
  | 'component'
  | 'hose'
  | 'nozzle'
  | 'accessory'
  | 'spare'
  | 'connected_to'
  | 'other';

export interface EquipmentRelationshipRow {
  id: string;
  parent_equipment_id: string;
  child_equipment_id: string;
  relationship_type: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  child?: {
    id: string;
    name: string;
    internal_code: string;
    short_code: string | null;
    location: string | null;
  } | null;
  parent?: {
    id: string;
    name: string;
    internal_code: string;
    short_code: string | null;
    location: string | null;
  } | null;
}

/**
 * Fetch relationships where the given equipment is parent or child.
 */
export function useEquipmentRelationships(equipmentId?: string) {
  return useQuery({
    queryKey: ['equipment-relationships', equipmentId],
    enabled: !!equipmentId,
    queryFn: async () => {
      if (!equipmentId) return { asParent: [], asChild: [] };

      const [{ data: asParent, error: e1 }, { data: asChild, error: e2 }] = await Promise.all([
        supabase
          .from('equipment_relationships')
          .select(
            `*, child:equipment!equipment_relationships_child_equipment_id_fkey(id, name, internal_code, short_code, location)`
          )
          .eq('parent_equipment_id', equipmentId),
        supabase
          .from('equipment_relationships')
          .select(
            `*, parent:equipment!equipment_relationships_parent_equipment_id_fkey(id, name, internal_code, short_code, location)`
          )
          .eq('child_equipment_id', equipmentId),
      ]);

      if (e1) throw e1;
      if (e2) throw e2;
      return {
        asParent: (asParent ?? []) as EquipmentRelationshipRow[],
        asChild: (asChild ?? []) as EquipmentRelationshipRow[],
      };
    },
  });
}

export function useCreateEquipmentRelationship() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      parent_equipment_id: string;
      child_equipment_id: string;
      relationship_type: RelationshipType;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('equipment_relationships')
        .insert({ ...input, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment-relationships'] });
      qc.invalidateQueries({ queryKey: ['equipment-relationships', vars.parent_equipment_id] });
      qc.invalidateQueries({ queryKey: ['equipment-relationships', vars.child_equipment_id] });
      toast({
        title: t('hooks.relationships.created', 'Vínculo criado'),
        description: t('hooks.relationships.createdDesc', 'O vínculo foi criado com sucesso.'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.relationships.createError', 'Erro ao criar vínculo'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteEquipmentRelationship() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipment_relationships').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipment-relationships'] });
      toast({
        title: t('hooks.relationships.deleted', 'Vínculo removido'),
        description: t('hooks.relationships.deletedDesc', 'O vínculo foi removido.'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.relationships.deleteError', 'Erro ao remover vínculo'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}
