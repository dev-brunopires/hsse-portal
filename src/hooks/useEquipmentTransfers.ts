import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';

export interface EquipmentTransfer {
  id: string;
  equipment_id: string;
  from_ship_id: string | null;
  to_ship_id: string;
  transferred_by: string | null;
  transfer_date: string;
  reason: string | null;
  notes: string | null;
  created_at: string;
  equipment?: {
    name: string;
    internal_code: string;
  };
  from_ship?: { name: string } | null;
  to_ship?: { name: string } | null;
  transferred_by_profile?: { full_name: string } | null;
}

export function useEquipmentTransfers(equipmentId?: string) {
  return useQuery({
    queryKey: ['equipment-transfers', equipmentId],
    queryFn: async (): Promise<EquipmentTransfer[]> => {
      let query = supabase
        .from('equipment_transfers')
        .select(`
          *,
          equipment (name, internal_code),
          from_ship:ships!equipment_transfers_from_ship_id_fkey (name),
          to_ship:ships!equipment_transfers_to_ship_id_fkey (name)
        `)
        .order('transfer_date', { ascending: false });

      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for transferred_by
      const transfers = data || [];
      const userIds = [...new Set(transfers.filter(t => t.transferred_by).map(t => t.transferred_by))];
      
      let profiles: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        
        profiles = (profilesData || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      return transfers.map(t => ({
        ...t,
        transferred_by_profile: t.transferred_by ? { full_name: profiles[t.transferred_by] || i18n.t('hooks.transfer.unknown') } : null,
      })) as EquipmentTransfer[];
    },
  });
}

export function useCreateEquipmentTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      equipmentId,
      fromShipId,
      toShipId,
      reason,
      notes,
    }: {
      equipmentId: string;
      fromShipId: string | null;
      toShipId: string;
      reason?: string;
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // Create transfer record
      const { error: transferError } = await supabase
        .from('equipment_transfers')
        .insert({
          equipment_id: equipmentId,
          from_ship_id: fromShipId,
          to_ship_id: toShipId,
          transferred_by: user?.user?.id,
          reason,
          notes,
        });

      if (transferError) throw transferError;

      // Update equipment ship_id
      const { error: updateError } = await supabase
        .from('equipment')
        .update({ ship_id: toShipId })
        .eq('id', equipmentId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('hooks.transfer.success'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.transfer.error'));
      console.error('Error transferring equipment:', error);
    },
  });
}
