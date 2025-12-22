import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user is admin, admin_master, or platform_owner
    const [roleResult, platformOwnerResult] = await Promise.all([
      userClient.from('user_roles').select('role').eq('user_id', currentUser.id).maybeSingle(),
      userClient.from('platform_owners').select('id').eq('user_id', currentUser.id).maybeSingle(),
    ])

    const isPlatformOwner = !!platformOwnerResult.data
    const isAdmin = roleResult.data && ['admin', 'admin_master'].includes(roleResult.data.role)

    if (!isPlatformOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Only admins or platform owners can create users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { email, password, fullName, role, shipIds, language, organizationId: providedOrgId } = await req.json()

    // Determine organization ID
    let organizationId = providedOrgId

    // If not a platform owner providing an org ID, use the admin's organization
    if (!organizationId && !isPlatformOwner) {
      const { data: currentUserOrg } = await userClient
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', currentUser.id)
        .single()
      organizationId = currentUserOrg?.organization_id
    }

    console.log('Creating user with data:', { email, fullName, role, shipIds, language, organizationId, isPlatformOwner })

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: 'Email, password and fullName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default language to pt-BR if not provided
    const userLanguage = language || 'pt-BR'

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    })

    // Create user using admin API (won't log in as the new user)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      }
    })

    if (createError) {
      console.error('Error creating auth user:', createError)
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!newUser.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created with ID:', newUser.user.id)

    // Update profile with language and organization_id
    const profileUpdates: Record<string, unknown> = {}
    if (userLanguage !== 'pt-BR') {
      profileUpdates.language = userLanguage
    }
    if (organizationId) {
      profileUpdates.organization_id = organizationId
    }

    if (Object.keys(profileUpdates).length > 0) {
      console.log('Updating profile with:', profileUpdates)
      const { error: profileError } = await adminClient
        .from('profiles')
        .update(profileUpdates)
        .eq('user_id', newUser.user.id)
      
      if (profileError) {
        console.error('Error updating profile:', profileError)
      } else {
        console.log('Profile updated successfully')
      }
    }

    // Update role with organization_id
    if (organizationId) {
      console.log('Updating user role with organization_id:', organizationId)
      const { error: roleOrgError } = await adminClient
        .from('user_roles')
        .update({ organization_id: organizationId })
        .eq('user_id', newUser.user.id)
      
      if (roleOrgError) {
        console.error('Error updating role organization:', roleOrgError)
      }
    }

    // Update role if different from default viewer
    if (role && role !== 'viewer') {
      console.log('Updating user role to:', role)
      const { error: roleError } = await adminClient
        .from('user_roles')
        .update({ role })
        .eq('user_id', newUser.user.id)
      
      if (roleError) {
        console.error('Error updating role:', roleError)
      } else {
        console.log('Role updated successfully')
      }
    }

    // Add user to organization
    if (organizationId) {
      console.log('Adding user to organization:', organizationId)
      const { error: orgError } = await adminClient
        .from('user_organizations')
        .insert({
          user_id: newUser.user.id,
          organization_id: organizationId,
        })
      
      if (orgError) {
        console.error('Error adding user to organization:', orgError)
      } else {
        console.log('User added to organization successfully')
      }
    }

    // Assign ships to user if provided
    if (shipIds && Array.isArray(shipIds) && shipIds.length > 0) {
      console.log('Assigning ships to user:', shipIds)
      
      const shipAssignments = shipIds.map((shipId: string) => ({
        user_id: newUser.user.id,
        ship_id: shipId,
      }))

      const { error: shipError } = await adminClient
        .from('user_ships')
        .insert(shipAssignments)

      if (shipError) {
        console.error('Error assigning ships:', shipError)
      } else {
        console.log('Ships assigned successfully')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: { 
          id: newUser.user.id, 
          email: newUser.user.email 
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error creating user:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
