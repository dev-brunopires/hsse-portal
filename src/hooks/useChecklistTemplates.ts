import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';

export interface ChecklistTemplate {
  id: string;
  category_id: string;
  name: string;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  categories?: { name: string };
  items?: ChecklistTemplateItem[];
}

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  description: string;
  order_index: number;
  is_required: boolean;
  created_at: string;
}

export function useChecklistTemplates(categoryId?: string) {
  return useQuery({
    queryKey: ['checklist-templates', categoryId],
    queryFn: async (): Promise<ChecklistTemplate[]> => {
      let query = supabase
        .from('checklist_templates')
        .select(`
          *,
          categories (name),
          checklist_template_items (*)
        `)
        .order('name');

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        items: t.checklist_template_items?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
      })) as unknown as ChecklistTemplate[];
    },
  });
}

export function useDefaultChecklistTemplate(categoryId?: string) {
  return useQuery({
    queryKey: ['default-checklist-template', categoryId],
    queryFn: async (): Promise<ChecklistTemplate | null> => {
      if (!categoryId) return null;

      const { data, error } = await supabase
        .from('checklist_templates')
        .select(`
          *,
          checklist_template_items (*)
        `)
        .eq('category_id', categoryId)
        .eq('is_default', true)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        items: data.checklist_template_items?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
      } as unknown as ChecklistTemplate;
    },
    enabled: !!categoryId,
  });
}

export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      template,
      items,
    }: {
      template: { category_id: string; name: string; is_default?: boolean };
      items: { description: string; is_required?: boolean }[];
    }) => {
      const { data: user } = await supabase.auth.getUser();

      // If setting as default, unset other defaults first
      if (template.is_default) {
        await supabase
          .from('checklist_templates')
          .update({ is_default: false })
          .eq('category_id', template.category_id);
      }

      const { data: newTemplate, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          ...template,
          created_by: user?.user?.id,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          template_id: newTemplate.id,
          description: item.description,
          order_index: index,
          is_required: item.is_required ?? true,
        }));

        const { error: itemsError } = await supabase
          .from('checklist_template_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      queryClient.invalidateQueries({ queryKey: ['default-checklist-template'] });
      toast.success(i18n.t('hooks.checklistTemplate.created'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.checklistTemplate.createError'));
      console.error('Error creating checklist template:', error);
    },
  });
}

export function useUpdateChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      template,
      items,
    }: {
      id: string;
      template: { name?: string; is_default?: boolean; category_id?: string };
      items?: { id?: string; description: string; is_required?: boolean }[];
    }) => {
      // If setting as default, unset other defaults first
      if (template.is_default && template.category_id) {
        await supabase
          .from('checklist_templates')
          .update({ is_default: false })
          .eq('category_id', template.category_id)
          .neq('id', id);
      }

      const { error: templateError } = await supabase
        .from('checklist_templates')
        .update(template)
        .eq('id', id);

      if (templateError) throw templateError;

      if (items) {
        // Delete existing items
        await supabase
          .from('checklist_template_items')
          .delete()
          .eq('template_id', id);

        // Insert new items
        if (items.length > 0) {
          const itemsToInsert = items.map((item, index) => ({
            template_id: id,
            description: item.description,
            order_index: index,
            is_required: item.is_required ?? true,
          }));

          const { error: itemsError } = await supabase
            .from('checklist_template_items')
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      queryClient.invalidateQueries({ queryKey: ['default-checklist-template'] });
      toast.success(i18n.t('hooks.checklistTemplate.updated'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.checklistTemplate.updateError'));
      console.error('Error updating checklist template:', error);
    },
  });
}

export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('checklist_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist-templates'] });
      queryClient.invalidateQueries({ queryKey: ['default-checklist-template'] });
      toast.success(i18n.t('hooks.checklistTemplate.deleted'));
    },
    onError: (error) => {
      toast.error(i18n.t('hooks.checklistTemplate.deleteError'));
      console.error('Error deleting checklist template:', error);
    },
  });
}
