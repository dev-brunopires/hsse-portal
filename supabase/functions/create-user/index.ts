import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const SBM_ORGANIZATION_ID = '00000000-0000-0000-0000-000000000001'
const ROLE_RANK: Record<string, number> = {
  admin_master: 5,
  admin: 4,
  supervisor: 3,
  technician: 2,
  viewer: 1,
}

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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verify the request is from an authenticated admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header' }, 401)
    }

    // Create client with user's token to verify they're admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    // Get the current user
    const { data: { user: currentUser }, error: userError } = await userClient.auth.getUser()
    if (userError || !currentUser) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // Check if user is admin, admin_master, or platform_owner
    const [roleResult, platformOwnerResult] = await Promise.all([
      adminClient
        .from('user_roles')
        .select('role, organization_id')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false }),
      adminClient.from('platform_owners').select('id').eq('user_id', currentUser.id).maybeSingle(),
    ])

    if (roleResult.error || platformOwnerResult.error) {
      console.error('Error checking requester permissions:', {
        roleError: roleResult.error,
        platformOwnerError: platformOwnerResult.error,
      })
      return jsonResponse({ error: 'Unable to validate requester permissions' }, 500)
    }

    const isPlatformOwner = !!platformOwnerResult.data
    const currentUserRoleRow = pickHighestRole(roleResult.data, SBM_ORGANIZATION_ID)
    const currentUserRole = currentUserRoleRow?.role
    const currentUserOrgId = currentUserRoleRow?.organization_id
    const isAdmin = currentUserRole && ['admin', 'admin_master'].includes(currentUserRole)

    if (!isPlatformOwner && !isAdmin) {
      return jsonResponse({ error: 'Only admins or platform owners can create users' }, 403)
    }

    // Parse request body
    const { email, password, fullName, role, shipIds, language, organizationId: providedOrgId } = await req.json()

    const { data: sbmOrganization, error: sbmOrgError } = await adminClient
      .from('organizations')
      .select('id, name')
      .eq('id', SBM_ORGANIZATION_ID)
      .maybeSingle()

    if (sbmOrgError) {
      console.error('Error loading SBM organization:', sbmOrgError)
      return jsonResponse({ error: 'Unable to validate SBM organization' }, 500)
    }

    if (!sbmOrganization || !String(sbmOrganization.name ?? '').toLowerCase().includes('sbm')) {
      return jsonResponse({ error: 'SBM organization is not configured' }, 500)
    }

    const organizationId = sbmOrganization.id

    if (providedOrgId && providedOrgId !== organizationId) {
      return jsonResponse({ error: 'Users can only be created for SBM Offshore' }, 403)
    }

    // SECURITY: Non-platform owners can only create users in the SBM organization they belong to
    if (!isPlatformOwner && currentUserOrgId !== organizationId) {
      return jsonResponse({ error: 'You can only create users in the SBM organization' }, 403)
    }

    // SECURITY: Prevent privilege escalation - only admin_master/platform_owner can create admin roles
    if (role === 'admin_master') {
      if (!isPlatformOwner && currentUserRole !== 'admin_master') {
        return jsonResponse({ error: 'Only admin_master can create admin_master users' }, 403)
      }
    } else if (role === 'admin') {
      if (!isPlatformOwner && currentUserRole !== 'admin_master') {
        return jsonResponse({ error: 'Only admin_master can create admin users' }, 403)
      }
    }

    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedFullName = typeof fullName === 'string' ? fullName.trim() : ''

    console.log('Creating user with data:', {
      email: normalizedEmail,
      fullName: normalizedFullName,
      role,
      shipIds,
      language,
      organizationId,
      isPlatformOwner,
    })

    if (!normalizedEmail || !password || !normalizedFullName) {
      return jsonResponse({ error: 'Email, password and fullName are required' }, 400)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedEmail)) {
      return jsonResponse({ error: 'Invalid email format' }, 400)
    }

    // Validate password length
    if (typeof password !== 'string' || password.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters' }, 400)
    }

    // Validate fullName length
    if (normalizedFullName.length > 100) {
      return jsonResponse({ error: 'Full name must be less than 100 characters' }, 400)
    }

    // Validate role if provided
    const validRoles = ['viewer', 'technician', 'supervisor', 'admin', 'admin_master']
    if (role && !validRoles.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400)
    }

    // Default language to pt-BR if not provided
    const userLanguage = language === 'en' ? 'en' : 'pt-BR'
    const finalRole = role || 'viewer'
    const validShipIds = Array.isArray(shipIds)
      ? shipIds.filter((shipId): shipId is string => typeof shipId === 'string' && shipId.length > 0)
      : []

    // Create user using admin API (won't log in as the new user)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: normalizedFullName,
      }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return jsonResponse({ error: createError.message }, 400)
    }

    if (!newUser.user) {
      return jsonResponse({ error: 'Failed to create user' }, 500)
    }

    console.log('User created with ID:', newUser.user.id)

    const rollbackCreatedUser = async (reason: string, details: unknown) => {
      console.error(reason, details)
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(newUser.user.id)
      if (rollbackError) {
        console.error('Failed to rollback auth user after setup error:', rollbackError)
      }
      return jsonResponse({ error: reason }, 500)
    }

    // Persist app-facing user records explicitly. Do not rely only on the auth trigger.
    const profilePayload: Record<string, unknown> = {
      user_id: newUser.user.id,
      email: normalizedEmail,
      full_name: normalizedFullName,
      language: userLanguage,
    }
    if (organizationId) {
      profilePayload.organization_id = organizationId
    }

    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })

    if (profileError) {
      return await rollbackCreatedUser('Error creating user profile', profileError)
    }

    const { error: removeDefaultRoleError } = await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', newUser.user.id)

    if (removeDefaultRoleError) {
      return await rollbackCreatedUser('Error preparing user role', removeDefaultRoleError)
    }

    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: finalRole,
        organization_id: organizationId || null,
      })

    if (roleError) {
      return await rollbackCreatedUser('Error creating user role', roleError)
    }

    // Add user to organization
    if (organizationId) {
      console.log('Adding user to organization:', organizationId)
      const { error: orgError } = await adminClient
        .from('user_organizations')
        .upsert({
          user_id: newUser.user.id,
          organization_id: organizationId,
        }, { onConflict: 'user_id,organization_id' })
      
      if (orgError) {
        return await rollbackCreatedUser('Error adding user to organization', orgError)
      }
    }

    // Assign ships to user if provided
    if (validShipIds.length > 0) {
      console.log('Assigning ships to user:', validShipIds)
      
      const shipAssignments = validShipIds.map((shipId: string) => ({
        user_id: newUser.user.id,
        ship_id: shipId,
      }))

      const { error: shipError } = await adminClient
        .from('user_ships')
        .insert(shipAssignments)

      if (shipError) {
        return await rollbackCreatedUser('Error assigning ships to user', shipError)
      }
    }

    return jsonResponse({
      success: true,
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
        role: finalRole,
        organizationId: organizationId || null,
      },
    })

  } catch (error: unknown) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return jsonResponse({ error: message }, 500)
  }
})
