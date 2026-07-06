import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpcomingInspection {
  equipment_name: string;
  equipment_code: string;
  next_inspection_date: string;
  days_until: number;
  location: string;
  unit: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const [{ data: platformOwner }, { data: adminMaster }] = await Promise.all([
      supabase.from("platform_owners").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("id").eq("user_id", user.id).eq("role", "admin_master").limit(1).maybeSingle(),
    ]);
    if (!platformOwner && !adminMaster) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: withinRateLimit } = await supabase.rpc("consume_edge_rate_limit", {
      _subject_id: user.id,
      _action: "check-inspection-deadlines",
      _limit: 5,
      _window_seconds: 60,
    });
    if (!withinRateLimit) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Get equipment with inspections due in the next 7 days
    const today = new Date();
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const { data: equipment, error: equipmentError } = await supabase
      .from("equipment")
      .select(`
        id,
        name,
        internal_code,
        next_inspection,
        location,
        unit,
        ship_id
      `)
      .not("next_inspection", "is", null)
      .lte("next_inspection", sevenDaysFromNow.toISOString().split("T")[0])
      .gte("next_inspection", today.toISOString().split("T")[0]);

    if (equipmentError) {
      throw equipmentError;
    }

    if (!equipment || equipment.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming inspections found", count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get users who should receive notifications (admins and technicians)
    const { data: usersToNotify, error: usersError } = await supabase
      .from("user_roles")
      .select(`
        user_id,
        profiles!inner(email, full_name)
      `)
      .in("role", ["admin", "admin_master", "technician", "supervisor"]);

    if (usersError) {
      throw usersError;
    }

    // Prepare notification data
    const upcomingInspections: UpcomingInspection[] = equipment.map((eq) => {
      const nextDate = new Date(eq.next_inspection);
      const daysUntil = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        equipment_name: eq.name,
        equipment_code: eq.internal_code,
        next_inspection_date: eq.next_inspection,
        days_until: daysUntil,
        location: eq.location,
        unit: eq.unit,
      };
    });

    // Log notification attempt (in production, integrate with email service)
    console.log("Upcoming inspections to notify:", upcomingInspections);
    console.log("Users to notify:", usersToNotify);

    // Here you would integrate with your email service (SendGrid, Resend, etc.)
    // For now, we'll just return the data that would be sent
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `Found ${upcomingInspections.length} upcoming inspections`,
        inspections: upcomingInspections,
        notifyCount: usersToNotify?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in check-inspection-deadlines:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
