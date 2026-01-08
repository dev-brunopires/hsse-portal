import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client with the user's token to verify they're an admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client to check role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if requesting user is platform_owner, admin_master, or admin
    const [roleResult, platformOwnerResult] = await Promise.all([
      adminClient
        .from('user_roles')
        .select('role, organization_id')
        .eq('user_id', requestingUser.id)
        .single(),
      adminClient
        .from('platform_owners')
        .select('id')
        .eq('user_id', requestingUser.id)
        .maybeSingle(),
    ]);

    const isPlatformOwner = !!platformOwnerResult.data;
    const requestingUserRole = roleResult.data?.role;
    const requestingUserOrgId = roleResult.data?.organization_id;

    // Only admin, admin_master, or platform_owner can delete users
    if (!isPlatformOwner && (!requestingUserRole || !['admin', 'admin_master'].includes(requestingUserRole))) {
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user ID to delete from the request body
    const { userId } = await req.json();
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (userId === requestingUser.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the target user's role and organization
    const { data: targetUserRole, error: targetRoleError } = await adminClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single();

    if (targetRoleError) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Prevent privilege escalation attacks
    // 1. Only platform_owner can delete admin_master users
    if (targetUserRole.role === 'admin_master' && !isPlatformOwner) {
      return new Response(
        JSON.stringify({ error: 'Only platform owners can delete admin_master users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Only admin_master or platform_owner can delete admin users
    if (targetUserRole.role === 'admin' && !isPlatformOwner && requestingUserRole !== 'admin_master') {
      return new Response(
        JSON.stringify({ error: 'Only admin_master can delete admin users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Non-platform owners can only delete users from their own organization
    if (!isPlatformOwner && targetUserRole.organization_id !== requestingUserOrgId) {
      return new Response(
        JSON.stringify({ error: 'You can only delete users from your own organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete user_ships first (if any)
    await adminClient
      .from('user_ships')
      .delete()
      .eq('user_id', userId);

    // Delete user_organizations
    await adminClient
      .from('user_organizations')
      .delete()
      .eq('user_id', userId);

    // Delete user_roles
    await adminClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Delete profile
    await adminClient
      .from('profiles')
      .delete()
      .eq('user_id', userId);

    // Delete the user from auth.users using admin API
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
