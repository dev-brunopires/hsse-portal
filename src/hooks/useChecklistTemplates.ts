import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useOrganization } from '@/contexts/OrganizationContext';
import { translateError } from '@/utils/errorTranslation';

export interface ChecklistTemplate {
  id: string;
  category_id: string;
  name: string;
  is_default: boolean;
  created_by: string | null;
  organization_id: string | null;
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
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['checklist-templates', categoryId, organization?.id, isPlatformOwnerWithoutOrg],
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
      
      // Filter by organization (unless platform owner without org)
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      } else if (!isPlatformOwnerWithoutOrg) {
        // No org and not platform owner - return empty
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(t => ({
        ...t,
        items: t.checklist_template_items?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
      })) as unknown as ChecklistTemplate[];
    },
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    staleTime: 0, // Always refetch to get latest after edits
  });
}

export function useDefaultChecklistTemplate(categoryId?: string) {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['default-checklist-template', categoryId, organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async (): Promise<ChecklistTemplate | null> => {
      if (!categoryId) return null;

      let query = supabase
        .from('checklist_templates')
        .select(`
          *,
          checklist_template_items (*)
        `)
        .eq('category_id', categoryId)
        .eq('is_default', true);
      
      // Filter by organization (unless platform owner without org)
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      } else if (!isPlatformOwnerWithoutOrg) {
        return null;
      }
      
      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        items: data.checklist_template_items?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
      } as unknown as ChecklistTemplate;
    },
    enabled: !!categoryId && !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    staleTime: 0, // Always refetch to get latest checklist items
  });
}

export function useCreateChecklistTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({
      template,
      items,
    }: {
      template: { category_id: string; name: string; is_default?: boolean };
      items: { description: string; is_required?: boolean }[];
    }) => {
      if (!organization?.id) {
        throw new Error('Organização não encontrada');
      }

      const { data: user } = await supabase.auth.getUser();

      // If setting as default, unset other defaults first
      if (template.is_default) {
        await supabase
          .from('checklist_templates')
          .update({ is_default: false })
          .eq('category_id', template.category_id)
          .eq('organization_id', organization.id);
      }

      const { data: newTemplate, error: templateError } = await supabase
        .from('checklist_templates')
        .insert({
          ...template,
          created_by: user?.user?.id,
          organization_id: organization.id,
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
      toast({
        title: t('hooks.checklistTemplate.created'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.checklistTemplate.createError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateChecklistTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { organization } = useOrganization();

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
      if (template.is_default && template.category_id && organization?.id) {
        await supabase
          .from('checklist_templates')
          .update({ is_default: false })
          .eq('category_id', template.category_id)
          .eq('organization_id', organization.id)
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
      toast({
        title: t('hooks.checklistTemplate.updated'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.checklistTemplate.updateError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteChecklistTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

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
      toast({
        title: t('hooks.checklistTemplate.deleted'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.checklistTemplate.deleteError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}
