import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HealthCheckResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  latency?: number;
  message?: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const results: HealthCheckResult[] = [];
  const startTime = performance.now();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    
    // If this is just a health check ping, return immediately
    if (body.healthCheck) {
      return new Response(
        JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client for admin operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const [{ data: platformOwner }, { data: adminMaster }] = await Promise.all([
      adminClient.from("platform_owners").select("id").eq("user_id", user.id).maybeSingle(),
      adminClient.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin_master").limit(1).maybeSingle(),
    ]);
    if (!platformOwner && !adminMaster) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: withinRateLimit } = await adminClient.rpc("consume_edge_rate_limit", {
      _subject_id: user.id,
      _action: "health-check",
      _limit: 20,
      _window_seconds: 60,
    });
    if (!withinRateLimit) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Check 1: Database connection with service role
    const dbStart = performance.now();
    try {
      const { data, error } = await adminClient
        .from('profiles')
        .select('count')
        .limit(1);
      
      const dbLatency = Math.round(performance.now() - dbStart);
      
      if (error) {
        results.push({
          component: 'database-admin',
          status: 'error',
          latency: dbLatency,
          message: error.message,
        });
      } else {
        results.push({
          component: 'database-admin',
          status: dbLatency > 500 ? 'warning' : 'ok',
          latency: dbLatency,
          message: `Admin access verified (${dbLatency}ms)`,
        });
      }
    } catch (err) {
      results.push({
        component: 'database-admin',
        status: 'error',
        message: err instanceof Error ? err.message : 'Connection failed',
      });
    }

    // Check 2: Table counts
    const tables = ['equipment', 'inspections', 'maintenance_requests', 'certificates', 'profiles'];
    for (const table of tables) {
      const tableStart = performance.now();
      try {
        const { count, error } = await adminClient
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        const tableLatency = Math.round(performance.now() - tableStart);
        
        if (error) {
          results.push({
            component: `table-${table}`,
            status: 'error',
            latency: tableLatency,
            message: error.message,
          });
        } else {
          results.push({
            component: `table-${table}`,
            status: 'ok',
            latency: tableLatency,
            message: `${count || 0} records`,
            details: { count },
          });
        }
      } catch (err) {
        results.push({
          component: `table-${table}`,
          status: 'error',
          message: err instanceof Error ? err.message : 'Query failed',
        });
      }
    }

    // Check 3: Storage buckets
    const buckets = ['equipment-documents', 'inspection-photos', 'maintenance-photos', 'avatars', 'organization-logos', 'certificates'];
    for (const bucket of buckets) {
      const bucketStart = performance.now();
      try {
        const { data, error } = await adminClient.storage.from(bucket).list('', { limit: 1 });
        const bucketLatency = Math.round(performance.now() - bucketStart);
        
        if (error) {
          results.push({
            component: `storage-${bucket}`,
            status: 'error',
            latency: bucketLatency,
            message: error.message,
          });
        } else {
          results.push({
            component: `storage-${bucket}`,
            status: 'ok',
            latency: bucketLatency,
            message: `Accessible (${bucketLatency}ms)`,
          });
        }
      } catch (err) {
        results.push({
          component: `storage-${bucket}`,
          status: 'error',
          message: err instanceof Error ? err.message : 'Access failed',
        });
      }
    }

    // Check 4: Auth service
    const authStart = performance.now();
    try {
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
      const authLatency = Math.round(performance.now() - authStart);
      
      if (error) {
        results.push({
          component: 'auth-admin',
          status: 'error',
          latency: authLatency,
          message: error.message,
        });
      } else {
        results.push({
          component: 'auth-admin',
          status: 'ok',
          latency: authLatency,
          message: `Auth service operational (${authLatency}ms)`,
        });
      }
    } catch (err) {
      results.push({
        component: 'auth-admin',
        status: 'error',
        message: err instanceof Error ? err.message : 'Auth check failed',
      });
    }

    const totalLatency = Math.round(performance.now() - startTime);
    const hasErrors = results.some(r => r.status === 'error');
    const hasWarnings = results.some(r => r.status === 'warning');

    return new Response(
      JSON.stringify({
        status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'ok',
        timestamp: new Date().toISOString(),
        totalLatency,
        results,
        summary: {
          total: results.length,
          ok: results.filter(r => r.status === 'ok').length,
          warning: results.filter(r => r.status === 'warning').length,
          error: results.filter(r => r.status === 'error').length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
        results,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
