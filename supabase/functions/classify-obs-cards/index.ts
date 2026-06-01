// Edge function: classify obs_cards descriptions into HSSE risk types via Lovable AI.
// Deploy: `supabase functions deploy classify-obs-cards --project-ref ovugummbxablwmbpbbhj`
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Granular HSSE risk-type taxonomy. NO generic "Other" — model must commit.
const RISK_TYPES = [
  'Queda de altura',
  'Queda de objetos',
  'Esmagamento/Prensagem',
  'Impacto/Choque mecânico',
  'Corte/Perfuração',
  'Escorregão e tropeço',
  'Exposição a produtos químicos',
  'Vazamento/Derramamento',
  'Choque elétrico',
  'Arco elétrico',
  'Queimadura/Fogo',
  'Estresse térmico',
  'Postura/Esforço repetitivo',
  'Levantamento manual',
  'Pressão/Liberação de energia',
  'Atmosfera explosiva',
  'EPI ausente/inadequado',
  'Permissão de trabalho',
  'Sinalização/Isolamento',
  'Içamento/Rigging',
  'Espaço confinado',
  'Trabalho a quente',
  'Vazamento ao mar',
  'Resíduos',
  'Ato inseguro',
  'Falta de atenção',
  'Housekeeping',
  'Ferramenta/Equipamento inadequado',
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const SYSTEM_PROMPT = `You are a senior HSSE risk analyst. For each safety observation card description, you MUST:
1. Pick EXACTLY ONE risk type from this fixed taxonomy: ${RISK_TYPES.join(', ')}.
2. Assess severity (risk_level): low | medium | high | critical.
3. Provide a one-sentence Portuguese reasoning (max 140 chars) explaining the choice.

Rules:
- Read in Portuguese or English. Identify the most probable risk type — NEVER use generic labels.
- If the description is vague (e.g. "área desorganizada"), use context to infer (e.g. Housekeeping).
- If multiple risks apply, pick the most critical/specific.
- Return ONLY via the provided tool call.`;

interface Card {
  id: string;
  description: string | null;
}

interface Classification {
  category: string;
  risk_level: string;
  reasoning: string;
}

async function classifyBatch(
  cards: Card[],
  apiKey: string,
): Promise<Record<string, Classification>> {
  const userText = cards
    .map((c, i) => `${i + 1}. [id=${c.id}] ${(c.description || '').slice(0, 600)}`)
    .join('\n');

  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Classify each card:\n${userText}` },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'submit_classifications',
          description: 'Return one risk classification per card id.',
          parameters: {
            type: 'object',
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    category: { type: 'string', enum: RISK_TYPES },
                    risk_level: { type: 'string', enum: RISK_LEVELS },
                    reasoning: { type: 'string', maxLength: 200 },
                  },
                  required: ['id', 'category', 'risk_level', 'reasoning'],
                  additionalProperties: false,
                },
              },
            },
            required: ['items'],
            additionalProperties: false,
          },
        },
      }],
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
  const parsed = JSON.parse(call) as { items: Array<Classification & { id: string }> };
  const out: Record<string, Classification> = {};
  for (const it of parsed.items) {
    if (RISK_TYPES.includes(it.category) && RISK_LEVELS.includes(it.risk_level)) {
      out[it.id] = {
        category: it.category,
        risk_level: it.risk_level,
        reasoning: (it.reasoning || '').slice(0, 200),
      };
    }
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

    const { dataset_id, batch_size = 25, reclassify = false } = await req.json();
    if (!dataset_id) {
      return new Response(JSON.stringify({ error: 'dataset_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If reclassify=true on first call, clear AI fields so everything reprocesses
    if (reclassify) {
      await supabase
        .from('obs_cards')
        .update({ ai_category: null, ai_risk_level: null, ai_reasoning: null })
        .eq('dataset_id', dataset_id);
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

    let mapping: Record<string, Classification> = {};
    try {
      mapping = await classifyBatch(cards, apiKey);
    } catch (err: any) {
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

    // Fallback: if model skipped a card, default to 'Ato inseguro' / 'medium'
    // (never "Other" — user requirement).
    let processed = 0;
    const updates: Array<Promise<unknown>> = [];
    for (const c of cards) {
      const cls = mapping[c.id] || {
        category: 'Ato inseguro',
        risk_level: 'medium',
        reasoning: 'Classificação padrão — IA não retornou categoria específica.',
      };
      updates.push(
        supabase.from('obs_cards').update({
          ai_category: cls.category,
          ai_risk_level: cls.risk_level,
          ai_reasoning: cls.reasoning,
        }).eq('id', c.id),
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
