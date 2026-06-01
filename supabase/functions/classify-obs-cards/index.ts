// Edge function: classify obs_cards descriptions into safety categories via Lovable AI.
// Deploy: `supabase functions deploy classify-obs-cards --project-ref ovugummbxablwmbpbbhj`
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CATEGORIES = [
  'PPE',
  'Housekeeping',
  'Dropped Objects',
  'Working at Height',
  'Hot Work',
  'Confined Space',
  'Lifting Operations',
  'Tools & Equipment',
  'Slips, Trips & Falls',
  'Hazardous Materials',
  'Permit to Work',
  'Environment',
  'Ergonomics',
  'Behavior',
  'Process Safety',
  'Fire Safety',
  'Electrical Safety',
  'Other',
];

const SYSTEM_PROMPT = `You are an HSSE safety analyst. Classify each safety observation card description into EXACTLY ONE category from this fixed taxonomy: ${CATEGORIES.join(
  ', ',
)}.
Rules:
- Read the description (Portuguese or English) and identify the core safety topic.
- If multiple topics apply, pick the most critical/specific one.
- Use "Other" only if nothing fits.
- Return ONLY via the provided tool call.`;

interface Card {
  id: string;
  description: string | null;
}

async function classifyBatch(cards: Card[], apiKey: string): Promise<Record<string, string>> {
  const userText = cards
    .map((c, i) => `${i + 1}. [id=${c.id}] ${(c.description || '').slice(0, 600)}`)
    .join('\n');

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Classify each card:\n${userText}` },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'submit_classifications',
            description: 'Return one category per card id.',
            parameters: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      category: { type: 'string', enum: CATEGORIES },
                    },
                    required: ['id', 'category'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['items'],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'submit_classifications' } },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`ai_gateway_${resp.status}: ${txt.slice(0, 300)}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) throw new Error('ai_no_tool_call');
  const parsed = JSON.parse(call) as { items: Array<{ id: string; category: string }> };
  const out: Record<string, string> = {};
  for (const it of parsed.items) {
    if (CATEGORIES.includes(it.category)) out[it.id] = it.category;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY not configured');

    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { dataset_id, batch_size = 40 } = await req.json();
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: 'dataset_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch unclassified rows with non-empty description
    const { data: rows, error: selErr } = await supabase
      .from('obs_cards')
      .select('id, description')
      .eq('dataset_id', dataset_id)
      .is('ai_category', null)
      .not('description', 'is', null)
      .limit(batch_size);
    if (selErr) throw selErr;

    const cards = (rows || []) as Card[];

    if (cards.length === 0) {
      // Count remaining (should be 0 of "classifiable")
      const { count } = await supabase
        .from('obs_cards')
        .select('id', { count: 'exact', head: true })
        .eq('dataset_id', dataset_id)
        .is('ai_category', null)
        .not('description', 'is', null);
      return new Response(
        JSON.stringify({ processed: 0, remaining: count || 0, done: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let mapping: Record<string, string> = {};
    try {
      mapping = await classifyBatch(cards, apiKey);
    } catch (err: any) {
      // Surface rate-limit / payment errors clearly
      const msg = String(err?.message || err);
      if (msg.includes('429')) {
        return new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (msg.includes('402')) {
        return new Response(JSON.stringify({ error: 'payment_required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw err;
    }

    // Update rows; mark unanswered as 'Other' so we don't reprocess forever
    let processed = 0;
    const updates: Array<Promise<unknown>> = [];
    for (const c of cards) {
      const category = mapping[c.id] || 'Other';
      updates.push(
        supabase.from('obs_cards').update({ ai_category: category }).eq('id', c.id),
      );
      processed += 1;
    }
    await Promise.all(updates);

    const { count: remaining } = await supabase
      .from('obs_cards')
      .select('id', { count: 'exact', head: true })
      .eq('dataset_id', dataset_id)
      .is('ai_category', null)
      .not('description', 'is', null);

    return new Response(
      JSON.stringify({ processed, remaining: remaining || 0, done: (remaining || 0) === 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
