import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTranslation } from 'react-i18next';
import { translateError } from '@/utils/errorTranslation';

export interface Ship {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  organization_id: string | null;
  region_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateShipData {
  name: string;
  code?: string;
  description?: string;
  region_id?: string | null;
}

export interface UpdateShipData {
  id: string;
  name?: string;
  code?: string;
  description?: string;
  region_id?: string | null;
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function useShips() {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();
  
  return useQuery({
    queryKey: ['ships', organization?.id, isPlatformOwnerWithoutOrg],
    queryFn: async () => {
      // Platform owner without org can see all ships
      if (isPlatformOwnerWithoutOrg) {
        const { data, error } = await supabase
          .from('ships')
          .select('*')
          .order('name');
        
        if (error) throw error;
        return data as Ship[];
      }
      
      // Regular user - filter by organization
      if (!organization?.id) {
        return [];
      }
      
      const { data, error } = await supabase
        .from('ships')
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');
      
      if (error) throw error;
      return data as Ship[];
    },
    // Enable when org is ready OR platform owner without org
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    staleTime: 1000 * 60 * 10, // 10 minutes - ships rarely change
  });
}

export function useCreateShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async (data: CreateShipData) => {
      if (!organization?.id) {
        throw new Error(t('errors.organizationNotFound'));
      }

      const { data: ship, error } = await supabase
        .from('ships')
        .insert({
          name: data.name.trim(),
          code: normalizeOptionalText(data.code),
          description: normalizeOptionalText(data.description),
          region_id: data.region_id || null,
          organization_id: organization.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return ship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: t('hooks.ships.created'),
        description: t('hooks.ships.createdDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.ships.createError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateShipData) => {
      const { id, ...updateData } = data;
      const shipUpdate = {
        ...updateData,
        ...(updateData.name !== undefined ? { name: updateData.name.trim() } : {}),
        ...(updateData.code !== undefined ? { code: normalizeOptionalText(updateData.code) } : {}),
        ...(updateData.description !== undefined ? { description: normalizeOptionalText(updateData.description) } : {}),
      };

      const { data: ship, error } = await supabase
        .from('ships')
        .update(shipUpdate)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return ship;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: t('hooks.ships.updated'),
        description: t('hooks.ships.updatedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.ships.updateError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteShip() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ships')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({
        title: t('hooks.ships.deleted'),
        description: t('hooks.ships.deletedDesc'),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t('hooks.ships.deleteError'),
        description: translateError(error),
        variant: 'destructive',
      });
    },
  });
}
