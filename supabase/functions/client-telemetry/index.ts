// Lovable Cloud Function: client-telemetry

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const events = Array.isArray(body?.events) ? body.events : [];

    // Log compactly so it’s searchable.
    for (const e of events.slice(0, 50)) {
      const ts = typeof e?.ts === 'number' ? new Date(e.ts).toISOString() : new Date().toISOString();
      const level = e?.level ?? 'info';
      const name = e?.name ?? 'unknown';
      const data = e?.data ?? {};
      console.log(`[client-telemetry] ${ts} ${level} ${name} ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[client-telemetry] error', err);
    return new Response(JSON.stringify({ ok: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
