import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ROLE_RANK: Record<string, number> = {
  admin_master: 5,
  admin: 4,
  supervisor: 3,
  technician: 2,
  viewer: 1,
}

const SBM_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001'

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const pickHighestRole = <T extends { role: string | null; organization_id: string | null }>(
  rows: T[] | null | undefined,
  preferredOrgId?: string,
) => {
  const candidates = rows ?? []
  const preferred = preferredOrgId
    ? candidates.filter((row) => row.organization_id === preferredOrgId)
    : candidates

  return (preferred.length > 0 ? preferred : candidates)
    .sort((a, b) => (ROLE_RANK[b.role ?? 'viewer'] ?? 0) - (ROLE_RANK[a.role ?? 'viewer'] ?? 0))[0] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !currentUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [callerRoleRes, callerPlatformRes] = await Promise.all([
      adminClient.from('user_roles').select('role, organization_id').eq('user_id', currentUser.id),
      adminClient.from('platform_owners').select('id').eq('user_id', currentUser.id).maybeSingle(),
    ])

    const callerIsPlatformOwner = !!callerPlatformRes.data
    const callerRoleRow = pickHighestRole(callerRoleRes.data, SBM_ORGANIZATION_ID)
    const callerRole = callerRoleRow?.role
    const callerOrgId = callerRoleRow?.organization_id
    const callerCanManage =
      callerIsPlatformOwner || callerRole === 'admin_master' || callerRole === 'admin'

    if (!callerCanManage) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { userId, newPassword } = body as { userId?: string; newPassword?: string }

    if (!userId || !newPassword) {
      return jsonResponse({ error: 'userId and newPassword are required' }, 400)
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) {
      return jsonResponse({ error: 'Password must be between 6 and 72 characters' }, 400)
    }

    if (userId === currentUser.id) {
      return jsonResponse({ error: 'Use the change password flow for your own account' }, 400)
    }

    // Load target user role + organization for privilege checks
    const { data: targetRoleRows } = await adminClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)

    const { data: targetPlatform } = await adminClient
      .from('platform_owners')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const targetIsPlatformOwner = !!targetPlatform
    const targetRoleRow = pickHighestRole(targetRoleRows, SBM_ORGANIZATION_ID)
    const targetRole = targetRoleRow?.role ?? 'viewer'
    const targetOrgId = targetRoleRow?.organization_id

    // Platform owners can reset anyone (except other platform owners are still allowed only by platform owners)
    if (targetIsPlatformOwner && !callerIsPlatformOwner) {
      return jsonResponse({ error: 'Cannot reset password of a platform owner' }, 403)
    }

    if (!callerIsPlatformOwner) {
      // Same organization required
      if (!callerOrgId || callerOrgId !== targetOrgId) {
        return jsonResponse({ error: 'You can only reset users in your own organization' }, 403)
      }

      // Privilege rank: caller must outrank the target
      const callerRank = ROLE_RANK[callerRole ?? 'viewer'] ?? 0
      const targetRank = ROLE_RANK[targetRole] ?? 0
      if (callerRank <= targetRank) {
        return jsonResponse({ error: 'You cannot reset the password of a user with equal or higher role' }, 403)
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password reset failed:', updateError)
      return jsonResponse({ error: updateError.message }, 400)
    }

    // Audit log
    try {
      await adminClient.from('audit_logs').insert({
        table_name: 'auth.users',
        record_id: userId,
        action: 'PASSWORD_RESET',
        user_id: currentUser.id,
        user_name: currentUser.email,
        new_data: { reset_by: currentUser.id, target_user: userId },
      })
    } catch (e) {
      console.error('Audit log failed:', e)
    }

    return jsonResponse({ success: true })
  } catch (error: unknown) {
    console.error('reset-user-password error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonResponse({ error: message }, 500)
  }
})
