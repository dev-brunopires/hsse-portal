import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { getCurrentOrganizationId, generateEquipmentDocumentPath } from '@/utils/storageHelpers';

export type EquipmentDocument = Tables<'equipment_documents'>;
export type EquipmentDocumentInsert = TablesInsert<'equipment_documents'>;

export function useEquipmentDocuments(equipmentId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-documents', equipmentId],
    queryFn: async () => {
      if (!equipmentId) return [];
      const { data, error } = await supabase
        .from('equipment_documents')
        .select('*')
        .eq('equipment_id', equipmentId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EquipmentDocument[];
    },
    enabled: !!equipmentId,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ 
      equipmentId, 
      file 
    }: { 
      equipmentId: string; 
      file: File;
    }) => {
      // Get organization ID for path prefix
      const organizationId = await getCurrentOrganizationId();
      if (!organizationId) {
        throw new Error('Organization not found');
      }

      const fileName = generateEquipmentDocumentPath(organizationId, equipmentId, file.name);
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('equipment-documents')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Create document record
      const { data, error: insertError } = await supabase
        .from('equipment_documents')
        .insert({
          equipment_id: equipmentId,
          file_name: file.name,
          file_path: fileName,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id || null,
        })
        .select()
        .single();
      
      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-documents', variables.equipmentId] });
      toast({
        title: t('hooks.document.uploaded'),
        description: t('hooks.document.uploadedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.document.uploadError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ 
      id, 
      filePath,
      equipmentId,
    }: { 
      id: string; 
      filePath: string;
      equipmentId: string;
    }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('equipment-documents')
        .remove([filePath]);
      
      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from('equipment_documents')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-documents', variables.equipmentId] });
      toast({
        title: t('hooks.document.deleted'),
        description: t('hooks.document.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.document.deleteError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDocumentUrl(filePath: string | undefined) {
  return useQuery({
    queryKey: ['document-url', filePath],
    queryFn: async () => {
      if (!filePath) return null;
      
      const { data } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(filePath, 3600); // 1 hour expiry
      
      return data?.signedUrl || null;
    },
    enabled: !!filePath,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
