import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { translateError } from '@/utils/errorTranslation';

export interface Region {
  id: string;
  organization_id: string;
  name: string;
  countries: string[];
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegionInput {
  name: string;
  countries: string[];
  description?: string;
}

export interface UpdateRegionInput extends RegionInput {
  id: string;
}

export function useRegions() {
  const { organization, isPlatformOwnerWithoutOrg, isLoading: isOrgLoading } = useOrganization();

  return useQuery({
    queryKey: ['regions', organization?.id, isPlatformOwnerWithoutOrg],
    enabled: !isOrgLoading && (!!organization?.id || isPlatformOwnerWithoutOrg),
    queryFn: async () => {
      if (isPlatformOwnerWithoutOrg) {
        const { data, error } = await supabase
          .from('regions' as any)
          .select('*')
          .order('name');
        if (error) throw error;
        return (data ?? []) as unknown as Region[];
      }

      if (!organization?.id) return [];

      const { data, error } = await supabase
        .from('regions' as any)
        .select('*')
        .eq('organization_id', organization.id)
        .order('name');
      if (error) throw error;
      return (data ?? []) as unknown as Region[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useCreateRegion() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: RegionInput) => {
      if (!organization?.id) throw new Error('Organization not found');

      const { data, error } = await supabase
        .from('regions' as any)
        .insert({
          organization_id: organization.id,
          name: input.name,
          countries: input.countries,
          description: input.description || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Region;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      toast({ title: 'Region created', description: 'The region is now available for ships.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error creating region', description: translateError(error), variant: 'destructive' });
    },
  });
}

export function useUpdateRegion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateRegionInput) => {
      const { data, error } = await supabase
        .from('regions' as any)
        .update({
          name: input.name,
          countries: input.countries,
          description: input.description || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Region;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({ title: 'Region updated', description: 'Region data was saved.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error updating region', description: translateError(error), variant: 'destructive' });
    },
  });
}

export function useDeleteRegion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('regions' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regions'] });
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      toast({ title: 'Region deleted', description: 'Ships linked to it were left without a region.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error deleting region', description: translateError(error), variant: 'destructive' });
    },
  });
}

export function useAssignRegionShips() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ regionId, shipIds }: { regionId: string; shipIds: string[] }) => {
      if (!organization?.id) throw new Error('Organization not found');

      const { error: clearError } = await supabase
        .from('ships')
        .update({ region_id: null } as any)
        .eq('organization_id', organization.id)
        .eq('region_id', regionId);
      if (clearError) throw clearError;

      if (shipIds.length === 0) return;

      const { error: assignError } = await supabase
        .from('ships')
        .update({ region_id: regionId } as any)
        .eq('organization_id', organization.id)
        .in('id', shipIds);
      if (assignError) throw assignError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ships'] });
      queryClient.invalidateQueries({ queryKey: ['regions'] });
    },
  });
}
