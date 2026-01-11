import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getCurrentOrganizationId, generateInspectionPhotoPath } from '@/utils/storageHelpers';
import type { InspectionChecklistItem, InspectionPhoto } from './useInspections';

interface UpdateChecklistItemData {
  id: string;
  status: string;
  notes: string | null;
}

interface AddPhotoData {
  inspectionId: string;
  file: File;
}

interface DeletePhotoData {
  id: string;
  filePath: string;
}

// Update individual checklist item
export function useUpdateChecklistItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, status, notes }: UpdateChecklistItemData) => {
      const { data, error } = await supabase
        .from('inspection_checklist_items')
        .update({ status, notes })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update multiple checklist items at once
export function useUpdateChecklistItems() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (items: UpdateChecklistItemData[]) => {
      const results = await Promise.all(
        items.map(async ({ id, status, notes }) => {
          const { data, error } = await supabase
            .from('inspection_checklist_items')
            .update({ status, notes })
            .eq('id', id)
            .select()
            .single();
          
          if (error) throw error;
          return data;
        })
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      toast({
        title: t('hooks.checklist.updated'),
        description: t('hooks.checklist.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Add photo to inspection
export function useAddInspectionPhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ inspectionId, file }: AddPhotoData) => {
      const organizationId = await getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization not found');
      }

      const filePath = generateInspectionPhotoPath(organizationId, inspectionId, file.name);
      
      const { error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      const { data, error } = await supabase
        .from('inspection_photos')
        .insert({
          inspection_id: inspectionId,
          file_name: file.name,
          file_path: filePath,
        })
        .select()
        .single();

      if (error) throw error;

      // Get signed URL for the new photo
      const { data: urlData } = await supabase.storage
        .from('inspection-photos')
        .createSignedUrl(filePath, 3600);

      return { ...data, signedUrl: urlData?.signedUrl };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      toast({
        title: t('hooks.photo.added'),
        description: t('hooks.photo.addedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Delete photo from inspection
export function useDeleteInspectionPhoto() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, filePath }: DeletePhotoData) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('inspection-photos')
        .remove([filePath]);
      
      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Continue to delete record even if storage delete fails
      }

      // Delete record from database
      const { error } = await supabase
        .from('inspection_photos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      toast({
        title: t('hooks.photo.deleted'),
        description: t('hooks.photo.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
