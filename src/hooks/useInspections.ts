import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useTranslation } from 'react-i18next';
import { getCurrentOrganizationId, generateInspectionPhotoPath } from '@/utils/storageHelpers';
import { translateError } from '@/utils/errorTranslation';

export type Inspection = Tables<'inspections'>;
export type InspectionInsert = TablesInsert<'inspections'>;
export type InspectionChecklistItem = Tables<'inspection_checklist_items'>;
export type InspectionPhoto = Tables<'inspection_photos'>;

export interface InspectionWithDetails extends Inspection {
  equipment?: { 
    name: string; 
    internal_code: string;
    serial_number?: string;
    type?: string;
    manufacturer?: string;
    model?: string;
    location?: string;
    capacity?: string | null;
  } | null;
  profiles?: { 
    full_name: string; 
    email: string;
    position?: string | null;
  } | null;
  inspection_checklist_items?: InspectionChecklistItem[];
  inspection_photos?: InspectionPhoto[];
}

export function useInspections() {
  const { selectedShipId, isFilterEnabled, isReady } = useShipFilter();
  
  return useQuery({
    queryKey: ['inspections', selectedShipId],
    enabled: isReady, // Wait for ship filter to be initialized
    queryFn: async () => {
      let query = supabase
        .from('inspections')
        .select('*')
        .order('inspection_date', { ascending: false });
      
      // Apply ship filter for admin/admin_master when a specific ship is selected
      if (isFilterEnabled && selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }
      
      const { data: inspections, error } = await query;
      
      if (error) throw error;
      
      // Fetch related data separately
      const equipmentIds = [...new Set(inspections.map(i => i.equipment_id))];
      const inspectorIds = [...new Set(inspections.map(i => i.inspector_id))];
      
      const [equipmentResult, profilesResult] = await Promise.all([
        supabase.from('equipment').select('id, name, internal_code, serial_number, type, manufacturer, model, location, capacity').in('id', equipmentIds),
        supabase.from('profiles').select('user_id, full_name, email, position').in('user_id', inspectorIds),
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
        .select('user_id, full_name, email, position')
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

// Hook to get the last inspection for an equipment
export function useLastInspection(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['last-inspection', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return null;
      
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('inspection_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!equipmentId,
  });
}

interface CreateInspectionData {
  inspection: InspectionInsert & {
    signature_data?: string | null;
    signed_at?: string | null;
  };
  checklistItems: { description: string; status: string; notes: string }[];
  photos: File[];
}

// Calculate next inspection date based on category frequency
function calculateNextInspectionDate(inspectionDate: string, frequency: string): string {
  const date = new Date(inspectionDate);
  
  switch (frequency) {
    case 'monthly':
      date.setDate(date.getDate() + 30);
      break;
    case 'quarterly':
      date.setDate(date.getDate() + 90);
      break;
    case 'semi-annual':
      date.setDate(date.getDate() + 180);
      break;
    case 'annual':
      date.setDate(date.getDate() + 365);
      break;
    default:
      date.setDate(date.getDate() + 30); // Default to monthly
  }
  
  return date.toISOString().split('T')[0];
}

// Map inspection status to equipment status
function mapInspectionToEquipmentStatus(inspectionStatus: string): string {
  switch (inspectionStatus) {
    case 'compliant':
      return 'active'; // Conforme → Ativo
    case 'attention':
      return 'maintenance'; // Atenção → Em Manutenção
    case 'non-compliant':
      return 'rejected'; // Não Conforme → Reprovado
    default:
      return 'active';
  }
}

export function useCreateInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ inspection, checklistItems, photos }: CreateInspectionData) => {
      // First, fetch the equipment to get its category frequency and ship_id
      const { data: equipmentData, error: equipmentFetchError } = await supabase
        .from('equipment')
        .select('id, category_id, ship_id, categories:category_id(inspection_frequency)')
        .eq('id', inspection.equipment_id)
        .single();
      
      if (equipmentFetchError) throw equipmentFetchError;
      
      // Calculate next inspection date based on category frequency
      const frequency = (equipmentData.categories as any)?.inspection_frequency || 'monthly';
      const calculatedNextDate = calculateNextInspectionDate(
        inspection.inspection_date || new Date().toISOString().split('T')[0],
        frequency
      );
      
      // Use calculated date (override any manually provided date)
      const nextInspectionDate = calculatedNextDate;

      // Create inspection with calculated next date and ship_id from equipment
      const { data: inspectionData, error: inspectionError } = await supabase
        .from('inspections')
        .insert({
          ...inspection,
          ship_id: equipmentData.ship_id, // Link inspection to equipment's ship
          next_inspection_date: nextInspectionDate,
        })
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

      // Upload photos with organization prefix
      if (photos.length > 0) {
        const organizationId = await getCurrentOrganizationId();
        if (!organizationId) {
          throw new Error('Organization not found');
        }

        for (const photo of photos) {
          const fileName = generateInspectionPhotoPath(organizationId, inspectionData.id, photo.name);
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

      // Update equipment with correct status mapping
      const equipmentStatus = mapInspectionToEquipmentStatus(inspection.status);
      
      await supabase
        .from('equipment')
        .update({
          last_inspection: inspection.inspection_date,
          next_inspection: nextInspectionDate,
          status: equipmentStatus,
        })
        .eq('id', inspection.equipment_id);

      return inspectionData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: t('hooks.inspection.created'),
        description: t('hooks.inspection.createdDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.inspection.createError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

interface UpdateInspectionData {
  id: string;
  inspection: Partial<InspectionInsert>;
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, inspection }: UpdateInspectionData) => {
      const { data, error } = await supabase
        .from('inspections')
        .update(inspection)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If status changed, update equipment status
      if (inspection.status) {
        const equipmentStatus = mapInspectionToEquipmentStatus(inspection.status);
        
        await supabase
          .from('equipment')
          .update({
            status: equipmentStatus,
            ...(inspection.inspection_date && { last_inspection: inspection.inspection_date }),
            ...(inspection.next_inspection_date !== undefined && { next_inspection: inspection.next_inspection_date }),
          })
          .eq('id', data.equipment_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: t('hooks.inspection.updated'),
        description: t('hooks.inspection.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.inspection.updateError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      // First get the inspection to know the equipment_id
      const { data: inspection, error: fetchError } = await supabase
        .from('inspections')
        .select('equipment_id')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Delete the inspection (cascade will delete checklist items and photos)
      const { error } = await supabase
        .from('inspections')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Find the latest remaining inspection for this equipment to update its status
      const { data: latestInspection } = await supabase
        .from('inspections')
        .select('*')
        .eq('equipment_id', inspection.equipment_id)
        .order('inspection_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Update equipment based on latest inspection or reset if none
      if (latestInspection) {
        const equipmentStatus = mapInspectionToEquipmentStatus(latestInspection.status);
        await supabase
          .from('equipment')
          .update({
            last_inspection: latestInspection.inspection_date,
            next_inspection: latestInspection.next_inspection_date,
            status: equipmentStatus,
          })
          .eq('id', inspection.equipment_id);
      } else {
        // No more inspections, reset equipment status
        await supabase
          .from('equipment')
          .update({
            last_inspection: null,
            next_inspection: null,
            status: 'active',
          })
          .eq('id', inspection.equipment_id);
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast({
        title: t('hooks.inspection.deleted'),
        description: t('hooks.inspection.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.inspection.deleteError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}
