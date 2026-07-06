import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import {
  ACCESS_MODULES,
  EMPTY_PERMISSION_FLAGS,
  ACCESS_ACTIONS,
  type AccessAction,
  type PermissionFlags,
  type AppRole,
  getDefaultRolePermission,
} from '@/config/accessControl';

export interface UserPermissionRow extends PermissionFlags {
  id?: string;
  user_id: string;
  organization_id: string | null;
  module_key: string;
  page_key: string;
}

type PermissionInput = Omit<UserPermissionRow, 'id'>;

interface SupabaseReadQuery<T> extends PromiseLike<{ data: T | null; error: { message: string } | null }> {
  select: (columns?: string) => SupabaseReadQuery<T>;
  eq: (column: string, value: string) => SupabaseReadQuery<T>;
}

interface SupabaseWriteQuery extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  upsert: (
    values: unknown,
    options?: { onConflict?: string },
  ) => SupabaseWriteQuery;
}

const accessDb = supabase as unknown as {
  from: <T = unknown>(table: string) => SupabaseReadQuery<T> & SupabaseWriteQuery;
};

function actionToFlag(action: AccessAction): keyof PermissionFlags {
  return ACCESS_ACTIONS.find(item => item.key === action)?.flag ?? 'can_view';
}

function keyFor(moduleKey: string, pageKey: string) {
  return `${moduleKey}.${pageKey}`;
}

export function useAccess() {
  const { user, role, isAdmin, isPlatformOwner } = useAuth();
  const { organization, isLoading: orgLoading } = useOrganization();

  const query = useQuery({
    queryKey: ['access-permissions', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const request = accessDb
        .from<UserPermissionRow[]>('user_module_permissions')
        .select('*')
        .eq('user_id', user!.id);

      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const permissions = useMemo(() => {
    if (orgLoading) return [];
    return (query.data ?? []).filter(row => (
      row.organization_id === null || row.organization_id === organization?.id
    ));
  }, [query.data, organization?.id, orgLoading]);

  const permissionMap = useMemo(() => {
    const map = new Map<string, UserPermissionRow>();
    permissions.forEach(row => {
      map.set(keyFor(row.module_key, row.page_key), row);
    });
    return map;
  }, [permissions]);

  const hasExplicitPermissions = permissions.length > 0;

  const can = (moduleKey: string, pageKey: string, action: AccessAction = 'view') => {
    if (isPlatformOwner || isAdmin) return true;

    const explicit = permissionMap.get(keyFor(moduleKey, pageKey));
    if (explicit) {
      return Boolean(explicit[actionToFlag(action)]);
    }

    if (!hasExplicitPermissions && !role && moduleKey === 'obs_cards' && pageKey === 'safety_observation') {
      return action === 'view' || action === 'create';
    }

    if (hasExplicitPermissions && moduleKey === 'obs_cards' && pageKey === 'safety_observation') {
      const obsCardsPermissions = permissions.filter(row => row.module_key === 'obs_cards');
      const canUseObsCardsModule = obsCardsPermissions.some(row => row.can_view);
      if (!canUseObsCardsModule) return false;

      if (action === 'view' || action === 'create') return true;
      if (action === 'edit') return obsCardsPermissions.some(row => row.can_edit || row.can_admin);
      if (action === 'export') return obsCardsPermissions.some(row => row.can_export || row.can_admin);
      return false;
    }

    if (hasExplicitPermissions) return false;
    return getDefaultRolePermission(role as AppRole | null, moduleKey, pageKey, action);
  };

  const canViewModule = (moduleKey: string) => {
    const module = ACCESS_MODULES.find(item => item.key === moduleKey);
    return module?.pages.some(page => can(moduleKey, page.key, 'view')) ?? false;
  };

  return {
    ...query,
    isLoading: query.isLoading || orgLoading,
    can,
    canViewModule,
    hasExplicitPermissions,
    permissions,
  };
}

export function useUserAccessPermissions(userId?: string | null) {
  const { organization, isLoading: orgLoading } = useOrganization();

  return useQuery({
    queryKey: ['user-access-permissions', userId, organization?.id],
    enabled: !!userId && !orgLoading,
    queryFn: async () => {
      let request = accessDb
        .from<UserPermissionRow[]>('user_module_permissions')
        .select('*')
        .eq('user_id', userId!);

      if (organization?.id) {
        request = request.eq('organization_id', organization.id);
      }

      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveUserAccessPermissions() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: PermissionInput[] }) => {
      if (!organization?.id) throw new Error('Organizacao nao encontrada');

      const normalized = permissions.map(permission => ({
        ...EMPTY_PERMISSION_FLAGS,
        ...permission,
        user_id: userId,
        organization_id: organization.id,
      }));

      const { error } = await accessDb
        .from('user_module_permissions')
        .upsert(normalized, {
          onConflict: 'user_id,organization_id,module_key,page_key',
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-access-permissions', variables.userId, organization?.id] });
      queryClient.invalidateQueries({ queryKey: ['access-permissions'] });
    },
  });
}
