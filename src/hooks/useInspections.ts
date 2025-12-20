import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

export type Inspection = Tables<'inspections'>;
export type InspectionInsert = TablesInsert<'inspections'>;
export type InspectionChecklistItem = Tables<'inspection_checklist_items'>;
export type InspectionPhoto = Tables<'inspection_photos'>;

export interface InspectionWithDetails extends Inspection {
  equipment?: { name: string; internal_code: string } | null;
  profiles?: { full_name: string; email: string } | null;
  inspection_checklist_items?: InspectionChecklistItem[];
  inspection_photos?: InspectionPhoto[];
}

export function useInspections() {
  return useQuery({
    queryKey: ['inspections'],
    queryFn: async () => {
      const { data: inspections, error } = await supabase
        .from('inspections')
        .select('*')
        .order('inspection_date', { ascending: false });
      
      if (error) throw error;
      
      // Fetch related data separately
      const equipmentIds = [...new Set(inspections.map(i => i.equipment_id))];
      const inspectorIds = [...new Set(inspections.map(i => i.inspector_id))];
      
      const [equipmentResult, profilesResult] = await Promise.all([
        supabase.from('equipment').select('id, name, internal_code').in('id', equipmentIds),
        supabase.from('profiles').select('user_id, full_name, email').in('user_id', inspectorIds),
      ]);
      
      const equipmentMap = new Map(equipmentResult.data?.map(e => [e.id, e]) || []);
      const profilesMap = new Map(profilesResult.data?.map(p => [p.user_id, p]) || []);
      
      return inspections.map(inspection => ({
        ...inspection,
        equipment: equipmentMap.get(inspection.equipment_id) || null,
        profiles: profilesMap.get(inspection.inspector_id) || null,
      })) as InspectionWithDetails[];
    },
  });
}

export function useInspectionsByEquipment(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['inspections', 'equipment', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return [];
      const { data: inspections, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('inspection_date', { ascending: false });
      
      if (error) throw error;
      
      const inspectorIds = [...new Set(inspections.map(i => i.inspector_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', inspectorIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return inspections.map(inspection => ({
        ...inspection,
        profiles: profilesMap.get(inspection.inspector_id) || null,
      })) as InspectionWithDetails[];
    },
    enabled: !!equipmentId,
  });
}

interface CreateInspectionData {
  inspection: InspectionInsert;
  checklistItems: { description: string; status: string; notes: string }[];
  photos: File[];
}

export function useCreateInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ inspection, checklistItems, photos }: CreateInspectionData) => {
      // Create inspection
      const { data: inspectionData, error: inspectionError } = await supabase
        .from('inspections')
        .insert(inspection)
        .select()
        .single();
      
      if (inspectionError) throw inspectionError;

      // Create checklist items
      if (checklistItems.length > 0) {
        const { error: checklistError } = await supabase
          .from('inspection_checklist_items')
          .insert(
            checklistItems.map((item) => ({
              inspection_id: inspectionData.id,
              description: item.description,
              status: item.status,
              notes: item.notes || null,
            }))
          );
        
        if (checklistError) throw checklistError;
      }

      // Upload photos
      if (photos.length > 0) {
        for (const photo of photos) {
          const fileName = `${inspectionData.id}/${Date.now()}-${photo.name}`;
          const { error: uploadError } = await supabase.storage
            .from('inspection-photos')
            .upload(fileName, photo);
          
          if (uploadError) throw uploadError;

          const { error: photoRecordError } = await supabase
            .from('inspection_photos')
            .insert({
              inspection_id: inspectionData.id,
              file_name: photo.name,
              file_path: fileName,
            });
          
          if (photoRecordError) throw photoRecordError;
        }
      }

      // Update equipment with last inspection date
      await supabase
        .from('equipment')
        .update({
          last_inspection: inspection.inspection_date,
          next_inspection: inspection.next_inspection_date,
          status: inspection.status === 'compliant' ? 'active' : 
                  inspection.status === 'non-compliant' ? 'rejected' : 'maintenance',
        })
        .eq('id', inspection.equipment_id);

      return inspectionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: 'Inspeção Registrada',
        description: 'A inspeção foi registrada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Registrar Inspeção',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
