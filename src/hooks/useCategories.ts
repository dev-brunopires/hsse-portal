import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/contexts/OrganizationContext';

export type Category = Tables<'categories'>;
export type CategoryInsert = TablesInsert<'categories'>;

export function useCategories() {
  const { organization } = useOrganization();
  
  return useQuery({
    queryKey: ['categories', organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('categories')
        .select('*')
        .order('name');
      
      // Filter by organization if available
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Category[];
    },
    enabled: !!organization?.id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (category: Omit<CategoryInsert, 'organization_id'>) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      const { data, error } = await supabase
        .from('categories')
        .insert({
          ...category,
          organization_id: organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: t('hooks.category.created'),
        description: t('hooks.category.createdDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.category.createError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<CategoryInsert, 'organization_id'>>) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(t('hooks.category.updatePermissionError'));
      }
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: t('hooks.category.updated'),
        description: t('hooks.category.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.category.updateError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: t('hooks.category.deleted'),
        description: t('hooks.category.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.category.deleteError'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
