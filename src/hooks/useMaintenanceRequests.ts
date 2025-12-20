import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';

export type MaintenanceType = 'preventive' | 'corrective';
export type MaintenanceStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'rejected';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export interface MaintenanceRequest {
  id: string;
  equipment_id: string;
  ship_id: string | null;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  description: string;
  problem_identified: string | null;
  requested_at: string;
  requested_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  started_at: string | null;
  started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
  rejection_reason: string | null;
  scheduled_date: string | null;
  work_performed: string | null;
  parts_used: string | null;
  observations: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequestWithDetails extends MaintenanceRequest {
  equipment?: {
    id: string;
    name: string;
    internal_code: string;
    serial_number: string;
    location: string;
    manufacturer: string | null;
    model: string | null;
  } | null;
  ships?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
  requester?: {
    full_name: string;
    email: string;
  } | null;
  approver?: {
    full_name: string;
  } | null;
  completer?: {
    full_name: string;
  } | null;
  photos?: MaintenancePhoto[];
}

export interface MaintenancePhoto {
  id: string;
  maintenance_request_id: string;
  file_name: string;
  file_path: string;
  photo_type: 'problem' | 'during' | 'after';
  created_at: string;
}

export interface CreateMaintenanceRequestData {
  equipment_id: string;
  ship_id: string | null;
  type: MaintenanceType;
  priority: MaintenancePriority;
  title: string;
  description: string;
  problem_identified?: string;
  scheduled_date?: string;
  requested_by: string;
}

export function useMaintenanceRequests() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();

  return useQuery({
    queryKey: ['maintenance-requests', selectedShipId],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch related data
      const equipmentIds = [...new Set((data || []).map(r => r.equipment_id))];
      const shipIds = [...new Set((data || []).filter(r => r.ship_id).map(r => r.ship_id))];
      const userIds = [...new Set((data || []).flatMap(r => 
        [r.requested_by, r.approved_by, r.completed_by].filter(Boolean)
      ))];

      const [equipmentResult, shipsResult, profilesResult] = await Promise.all([
        equipmentIds.length > 0 
          ? supabase.from('equipment').select('id, name, internal_code, serial_number, location, manufacturer, model').in('id', equipmentIds)
          : { data: [] },
        shipIds.length > 0 
          ? supabase.from('ships').select('id, name, code').in('id', shipIds as string[])
          : { data: [] },
        userIds.length > 0 
          ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds as string[])
          : { data: [] },
      ]);

      const equipmentMap = new Map(equipmentResult.data?.map(e => [e.id, e]) || []);
      const shipsMap = new Map(shipsResult.data?.map(s => [s.id, s]) || []);
      const profilesMap = new Map(profilesResult.data?.map(p => [p.user_id, p]) || []);

      return (data || []).map(request => ({
        ...request,
        equipment: equipmentMap.get(request.equipment_id) || null,
        ships: request.ship_id ? shipsMap.get(request.ship_id) || null : null,
        requester: request.requested_by ? profilesMap.get(request.requested_by) || null : null,
        approver: request.approved_by ? profilesMap.get(request.approved_by) || null : null,
        completer: request.completed_by ? profilesMap.get(request.completed_by) || null : null,
      })) as MaintenanceRequestWithDetails[];
    },
  });
}

export function useMaintenanceRequestDetails(requestId: string | undefined) {
  return useQuery({
    queryKey: ['maintenance-request', requestId],
    queryFn: async () => {
      if (!requestId) return null;

      const { data: request, error } = await supabase
        .from('maintenance_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;

      // Fetch related data
      const [equipmentResult, shipResult, photosResult, historyResult] = await Promise.all([
        supabase.from('equipment').select('id, name, internal_code, serial_number, location, manufacturer, model').eq('id', request.equipment_id).single(),
        request.ship_id ? supabase.from('ships').select('id, name, code').eq('id', request.ship_id).single() : { data: null },
        supabase.from('maintenance_photos').select('*').eq('maintenance_request_id', requestId).order('created_at', { ascending: false }),
        supabase.from('maintenance_requests').select('id, type, status, title, completed_at, work_performed').eq('equipment_id', request.equipment_id).neq('id', requestId).order('created_at', { ascending: false }).limit(10),
      ]);

      const userIds = [request.requested_by, request.approved_by, request.completed_by].filter(Boolean);
      const { data: profiles } = userIds.length > 0 
        ? await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds as string[])
        : { data: [] };

      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      return {
        ...request,
        equipment: equipmentResult.data,
        ships: shipResult.data,
        photos: photosResult.data || [],
        history: historyResult.data || [],
        requester: request.requested_by ? profilesMap.get(request.requested_by) || null : null,
        approver: request.approved_by ? profilesMap.get(request.approved_by) || null : null,
        completer: request.completed_by ? profilesMap.get(request.completed_by) || null : null,
      };
    },
    enabled: !!requestId,
  });
}

export function useCreateMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ request, photos }: { request: CreateMaintenanceRequestData; photos: File[] }) => {
      const { data, error } = await supabase
        .from('maintenance_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      // Upload photos
      if (photos.length > 0) {
        for (const photo of photos) {
          const fileName = `${data.id}/${Date.now()}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from('maintenance-photos')
            .upload(fileName, photo);

          if (uploadError) {
            console.error('Error uploading photo:', uploadError);
            continue;
          }

          await supabase.from('maintenance_photos').insert({
            maintenance_request_id: data.id,
            file_name: photo.name,
            file_path: fileName,
            photo_type: 'problem',
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      toast({
        title: 'Solicitação Criada',
        description: 'A solicitação de manutenção foi registrada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Criar Solicitação',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateMaintenanceStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      userId,
      additionalData 
    }: { 
      id: string; 
      status: MaintenanceStatus; 
      userId: string;
      additionalData?: Partial<MaintenanceRequest>;
    }) => {
      const updateData: Record<string, unknown> = { status, ...additionalData };

      switch (status) {
        case 'approved':
          updateData.approved_at = new Date().toISOString();
          updateData.approved_by = userId;
          break;
        case 'in_progress':
          updateData.started_at = new Date().toISOString();
          updateData.started_by = userId;
          break;
        case 'completed':
          updateData.completed_at = new Date().toISOString();
          updateData.completed_by = userId;
          break;
        case 'rejected':
          updateData.rejected_at = new Date().toISOString();
          updateData.rejected_by = userId;
          break;
      }

      const { data, error } = await supabase
        .from('maintenance_requests')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-request', variables.id] });
      
      const statusLabels: Record<MaintenanceStatus, string> = {
        pending: 'Pendente',
        approved: 'Aprovada',
        in_progress: 'Em Execução',
        completed: 'Concluída',
        rejected: 'Rejeitada',
      };

      toast({
        title: 'Status Atualizado',
        description: `Manutenção marcada como ${statusLabels[variables.status]}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Atualizar Status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteMaintenanceRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('maintenance_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-requests'] });
      toast({
        title: 'Solicitação Excluída',
        description: 'A solicitação de manutenção foi excluída com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Excluir',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useMaintenanceStats() {
  const { selectedShipId, isFilterEnabled } = useShipFilter();

  return useQuery({
    queryKey: ['maintenance-stats', selectedShipId],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_requests')
        .select('status, type, priority');

      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
        approved: data?.filter(r => r.status === 'approved').length || 0,
        inProgress: data?.filter(r => r.status === 'in_progress').length || 0,
        completed: data?.filter(r => r.status === 'completed').length || 0,
        rejected: data?.filter(r => r.status === 'rejected').length || 0,
        preventive: data?.filter(r => r.type === 'preventive').length || 0,
        corrective: data?.filter(r => r.type === 'corrective').length || 0,
        critical: data?.filter(r => r.priority === 'critical').length || 0,
        high: data?.filter(r => r.priority === 'high').length || 0,
      };

      return stats;
    },
  });
}
