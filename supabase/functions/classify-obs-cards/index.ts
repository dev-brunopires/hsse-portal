// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

const CATEGORIES = [
  "Queda de mesmo nível",
  "Queda de altura",
  "Queda de objeto",
  "Impacto / Prensagem",
  "Corte / Perfuração",
  "Choque elétrico",
  "Incêndio / Explosão",
  "Vazamento de produto químico",
  "Exposição a substância perigosa",
  "Exposição a ruído",
  "Exposição a calor / frio",
  "Espaço confinado",
  "Trabalho a quente",
  "Içamento de carga",
  "Movimentação de carga",
  "Operação de equipamento",
  "Veículo / Transporte",
  "Ergonomia / Postura",
  "EPI ausente ou inadequado",
  "Sinalização ausente ou inadequada",
  "Bloqueio / Etiquetagem (LOTO)",
  "Permissão de trabalho",
  "Procedimento não seguido",
  "Treinamento / Competência",
  "Housekeeping / Organização",
  "Meio ambiente / Derrame",
  "Saúde ocupacional",
  "Ato inseguro",
];

interface ObsCardRow {
  id: string;
  description: string | null;
  action_taken: string | null;
  obs_type: string | null;
  area: string | null;
  department: string | null;
}

function buildPrompt(cards: ObsCardRow[]) {
  return `You are an HSSE (Health, Safety, Security, Environment) specialist analyzing offshore/maritime observation cards.

For EACH card below, classify:
1. "category" — choose EXACTLY ONE from this list (do not invent new ones):
${CATEGORIES.map((c) => `- ${c}`).join("\n")}

2. "risk_level" — one of: low | medium | high | critical
   - low: minor issue, no immediate harm potential
   - medium: could cause injury without PPE / controls
   - high: serious injury likely if not addressed
   - critical: imminent danger, fatality potential

3. "reasoning" — 1 short sentence in Portuguese explaining why.

You MUST classify every card. Do not skip any. Commit to the closest match.

Cards (JSON):
${JSON.stringify(
  cards.map((c) => ({
    id: c.id,
    type: c.obs_type,
    area: c.area,
    department: c.department,
    description: c.description,
    immediate_action: c.immediate_action,
    recommended_action: c.recommended_action,
  })),
  null,
  2,
)}

Return STRICT JSON in this exact shape (no markdown, no commentary):
{"classifications":[{"id":"<card id>","category":"<one of list>","risk_level":"low|medium|high|critical","reasoning":"<pt-BR>"}]}`;
}

async function classifyBatch(cards: ObsCardRow[], apiKey: string) {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(cards) }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          classifications: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                category: { type: "STRING", enum: CATEGORIES },
                risk_level: { type: "STRING", enum: [...RISK_LEVELS] },
                reasoning: { type: "STRING" },
              },
              required: ["id", "category", "risk_level", "reasoning"],
            },
          },
        },
        required: ["classifications"],
      },
    },
  };

  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${text}`);
  }

  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  let parsed: { classifications: Array<{ id: string; category: string; risk_level: string; reasoning: string }> };
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
  }
  return parsed.classifications ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "GEMINI_API_KEY não configurado. Adicione a secret no projeto Supabase.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const datasetId = body.dataset_id ?? body.datasetId;
    const reclassify = body.reclassify === true;
    const batchSize = Math.max(1, Math.min(50, Number(body.batch_size) || 15));

    if (!datasetId) {
      return new Response(JSON.stringify({ error: "dataset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reset existing classifications when reclassify=true (only on the first call)
    if (reclassify) {
      await supabase
        .from("obs_cards")
        .update({ ai_category: null, ai_risk_level: null, ai_reasoning: null })
        .eq("dataset_id", datasetId);
    }

    // Count total still pending
    const { count: pendingBefore } = await supabase
      .from("obs_cards")
      .select("id", { count: "exact", head: true })
      .eq("dataset_id", datasetId)
      .is("ai_category", null);

    // Fetch ONE batch
    const { data: cards, error: fetchError } = await supabase
      .from("obs_cards")
      .select(
        "id, description, immediate_action, recommended_action, obs_type, area, department",
      )
      .eq("dataset_id", datasetId)
      .is("ai_category", null)
      .limit(batchSize);

    if (fetchError) throw fetchError;

    if (!cards || cards.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    try {
      const results = await classifyBatch(cards as ObsCardRow[], GEMINI_API_KEY);
      const byId = new Map(results.map((r) => [r.id, r]));

      for (const card of cards) {
        const r = byId.get(card.id);
        const update = r
          ? {
              ai_category: r.category,
              ai_risk_level: r.risk_level,
              ai_reasoning: r.reasoning,
            }
          : {
              ai_category: "Ato inseguro",
              ai_risk_level: "medium",
              ai_reasoning: "Classificação automática padrão (modelo não retornou).",
            };

        await supabase.from("obs_cards").update(update).eq("id", card.id);
        processed++;
      }
    } catch (err) {
      const msg = serializeError(err);
      console.error("Batch failed:", msg, err);
      return new Response(
        JSON.stringify({
          error: msg,
          processed: 0,
          remaining: pendingBefore ?? cards.length,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const remaining = Math.max(0, (pendingBefore ?? cards.length) - processed);
    return new Response(
      JSON.stringify({
        success: true,
        processed,
        remaining,
        done: remaining === 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = serializeError(err);
    console.error("classify-obs-cards error:", message, err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [e.message, e.details, e.hint, e.code]
      .filter(Boolean)
      .map(String);
    if (parts.length) return parts.join(" | ");
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return String(err);
}
