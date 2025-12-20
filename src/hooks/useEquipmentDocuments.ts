import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

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

  return useMutation({
    mutationFn: async ({ 
      equipmentId, 
      file 
    }: { 
      equipmentId: string; 
      file: File;
    }) => {
      const fileName = `${equipmentId}/${Date.now()}-${file.name}`;
      
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
        title: 'Documento Enviado',
        description: 'O documento foi enviado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao Enviar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        title: 'Documento Excluído',
        description: 'O documento foi excluído com sucesso.',
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
