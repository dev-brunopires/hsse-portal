import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

export type Category = Tables<'categories'>;
export type CategoryInsert = TablesInsert<'categories'>;

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Category[];
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (category: CategoryInsert) => {
      const { data, error } = await supabase
        .from('categories')
        .insert(category)
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CategoryInsert>) => {
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
