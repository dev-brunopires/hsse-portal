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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !currentUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const [callerRoleRes, callerPlatformRes] = await Promise.all([
      adminClient.from('user_roles').select('role, organization_id').eq('user_id', currentUser.id).maybeSingle(),
      adminClient.from('platform_owners').select('id').eq('user_id', currentUser.id).maybeSingle(),
    ])

    const callerIsPlatformOwner = !!callerPlatformRes.data
    const callerRole = callerRoleRes.data?.role
    const callerOrgId = callerRoleRes.data?.organization_id
    const callerCanManage =
      callerIsPlatformOwner || callerRole === 'admin_master' || callerRole === 'admin'

    if (!callerCanManage) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const { userId, newPassword } = body as { userId?: string; newPassword?: string }

    if (!userId || !newPassword) {
      return new Response(JSON.stringify({ error: 'userId and newPassword are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 72) {
      return new Response(JSON.stringify({ error: 'Password must be between 6 and 72 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (userId === currentUser.id) {
      return new Response(JSON.stringify({ error: 'Use the change password flow for your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load target user role + organization for privilege checks
    const { data: targetRoleRow } = await adminClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .maybeSingle()

    const { data: targetPlatform } = await adminClient
      .from('platform_owners')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()

    const targetIsPlatformOwner = !!targetPlatform
    const targetRole = targetRoleRow?.role ?? 'viewer'
    const targetOrgId = targetRoleRow?.organization_id

    // Platform owners can reset anyone (except other platform owners are still allowed only by platform owners)
    if (targetIsPlatformOwner && !callerIsPlatformOwner) {
      return new Response(JSON.stringify({ error: 'Cannot reset password of a platform owner' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!callerIsPlatformOwner) {
      // Same organization required
      if (!callerOrgId || callerOrgId !== targetOrgId) {
        return new Response(JSON.stringify({ error: 'You can only reset users in your own organization' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Privilege rank: caller must outrank the target
      const callerRank = ROLE_RANK[callerRole ?? 'viewer'] ?? 0
      const targetRank = ROLE_RANK[targetRole] ?? 0
      if (callerRank <= targetRank) {
        return new Response(JSON.stringify({ error: 'You cannot reset the password of a user with equal or higher role' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error('Password reset failed:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
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

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('reset-user-password error:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
