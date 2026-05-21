import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export interface ShipArea {
  id: string;
  ship_id: string;
  name: string;
  description: string | null;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useShipAreas(shipId?: string | null) {
  return useQuery({
    queryKey: ['ship-areas', shipId],
    queryFn: async () => {
      if (!shipId) return [] as ShipArea[];
      const { data, error } = await supabase
        .from('ship_areas')
        .select('*')
        .eq('ship_id', shipId)
        .order('name');
      if (error) throw error;
      return data as ShipArea[];
    },
    enabled: !!shipId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateShipArea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { ship_id: string; name: string; description?: string }) => {
      const name = input.name.trim();
      if (!name) throw new Error('Invalid name');
      const { data, error } = await supabase
        .from('ship_areas')
        .insert({ ship_id: input.ship_id, name, description: input.description || null })
        .select()
        .single();
      if (error) throw error;
      return data as ShipArea;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ship-areas', data.ship_id] });
    },
    onError: (e: Error) => {
      toast({ title: t('common.error', 'Erro'), description: e.message, variant: 'destructive' });
    },
  });
}

export function useDeleteShipArea() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (area: { id: string; ship_id: string }) => {
      const { error } = await supabase.from('ship_areas').delete().eq('id', area.id);
      if (error) throw error;
      return area;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ship-areas', data.ship_id] });
    },
    onError: (e: Error) => {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    },
  });
}

/**
 * Ensure an area exists for the given ship; returns immediately if name is empty.
 * Safe to call repeatedly (uses unique constraint with DO NOTHING).
 */
export async function ensureShipArea(shipId: string, name: string) {
  const clean = (name || '').trim();
  if (!clean || !shipId) return;
  try {
    await supabase.from('ship_areas').insert({ ship_id: shipId, name: clean });
  } catch {
    // ignore unique violation / RLS errors silently
  }
}

