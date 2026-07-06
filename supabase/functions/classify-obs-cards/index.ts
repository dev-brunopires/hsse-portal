// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
const STATUS_ASSESSMENTS = ["SAFE", "UNSAFE", "UNCLEAR"] as const;
const STATUS_ALIGNMENTS = [
  "aligned",
  "declared_safe_but_unsafe",
  "declared_unsafe_but_safe",
  "insufficient_info",
] as const;
const ACTION_QUALITIES = ["none", "weak", "adequate", "strong"] as const;
const BARRIER_FAILURES = [
  "people",
  "plant_equipment",
  "process_procedure",
  "ppe",
  "housekeeping",
  "ptw",
  "loto",
  "dropped_object",
  "line_of_fire",
  "environment",
  "occupational_health",
  "fire_explosion",
  "chemical",
  "manual_handling",
  "other",
] as const;

const CATEGORIES = [
  "Queda de mesmo nivel",
  "Queda de altura",
  "Queda de objeto",
  "Impacto / Prensagem",
  "Corte / Perfuracao",
  "Choque eletrico",
  "Incendio / Explosao",
  "Vazamento de produto quimico",
  "Exposicao a substancia perigosa",
  "Exposicao a ruido",
  "Exposicao a calor / frio",
  "Espaco confinado",
  "Trabalho a quente",
  "Icamento de carga",
  "Movimentacao de carga",
  "Operacao de equipamento",
  "Veiculo / Transporte",
  "Ergonomia / Postura",
  "EPI ausente ou inadequado",
  "Sinalizacao ausente ou inadequada",
  "Bloqueio / Etiquetagem (LOTO)",
  "Permissao de trabalho",
  "Procedimento nao seguido",
  "Treinamento / Competencia",
  "Housekeeping / Organizacao",
  "Meio ambiente / Derrame",
  "Saude ocupacional",
  "Ato inseguro",
] as const;

interface ObsCardRow {
  id: string;
  obs_type: string | null;
  status: string | null;
  description: string | null;
  action_taken: string | null;
}

interface ClassificationResult {
  id: string;
  category: string;
  risk_level: string;
  status_assessment: string;
  status_alignment: string;
  criticality_score: number;
  confidence: number;
  requires_followup: boolean;
  action_quality: string;
  barrier_failure: string;
  recommended_action: string;
  reasoning: string;
}

function buildPrompt(cards: ObsCardRow[]) {
  return `You are a senior offshore HSSE specialist reviewing observation cards.

For EACH card, perform a conservative safety assessment. The declared SAFE/UNSAFE status is only an input; do not trust it blindly. Compare it against the evidence in description and action_taken.

Classification rules:
- If the text describes an uncontrolled hazard, non-compliance, unsafe condition, unsafe act, degraded barrier, missing protection, exposure, or potential incident, assess status as UNSAFE even if declared SAFE.
- If the text describes safe behavior, correct compliance, positive intervention, or verified adequate control with no active hazard, assess status as SAFE.
- Use UNCLEAR only when the text is too vague to decide.
- Risk level must reflect credible worst consequence and barrier degradation, not only the actual outcome.
- critical: fatality/multiple fatalities, major fire/explosion, major dropped object, energized/electrical high risk, LOTO/PTW critical failure, major chemical exposure/spill, confined space life risk.
- high: serious injury, high potential near miss, uncontrolled energy, working at height, lifting/load path, rotating equipment exposure, hot work/fire potential, significant procedural breach.
- medium: recordable injury potential, local non-compliance, weak control, slip/trip, PPE issue with limited exposure, housekeeping with credible harm.
- low: positive safe behavior or minor issue with effective immediate control.

Return concise pt-BR outputs, written like a senior safety reviewer.

Fields:
1. category: EXACTLY ONE from:
${CATEGORIES.map((c) => `- ${c}`).join("\n")}
2. risk_level: low | medium | high | critical
3. status_assessment: SAFE | UNSAFE | UNCLEAR
4. status_alignment: aligned | declared_safe_but_unsafe | declared_unsafe_but_safe | insufficient_info
5. criticality_score: integer 1-5 (1 positive/minor, 5 life-threatening/high potential)
6. confidence: number 0.00-1.00
7. requires_followup: boolean
8. action_quality: none | weak | adequate | strong
9. barrier_failure: EXACTLY ONE from: ${BARRIER_FAILURES.join(" | ")}
10. recommended_action: short pt-BR action, specific and practical
11. reasoning: one short pt-BR sentence explaining the judgement

Classify every item. Use only the supplied card data. Do not invent facts, but infer credible hazards from the described task/condition.

Observations (JSON):
${JSON.stringify(cards.map((c) => ({
  id: c.id,
  type: c.obs_type ?? "",
  declared_status: c.status ?? "",
  description: c.description ?? "",
  action_taken: c.action_taken ?? "",
})))}

Return STRICT JSON: {"classifications":[{"id":"...","category":"...","risk_level":"...","status_assessment":"...","status_alignment":"...","criticality_score":1,"confidence":0.85,"requires_followup":true,"action_quality":"...","barrier_failure":"...","recommended_action":"...","reasoning":"..."}]}`;
}

async function classifyBatch(cards: ObsCardRow[], apiKey: string): Promise<ClassificationResult[]> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(cards) }],
      },
    ],
    generationConfig: {
      temperature: 0.05,
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
                category: { type: "STRING", enum: [...CATEGORIES] },
                risk_level: { type: "STRING", enum: [...RISK_LEVELS] },
                status_assessment: { type: "STRING", enum: [...STATUS_ASSESSMENTS] },
                status_alignment: { type: "STRING", enum: [...STATUS_ALIGNMENTS] },
                criticality_score: { type: "INTEGER" },
                confidence: { type: "NUMBER" },
                requires_followup: { type: "BOOLEAN" },
                action_quality: { type: "STRING", enum: [...ACTION_QUALITIES] },
                barrier_failure: { type: "STRING", enum: [...BARRIER_FAILURES] },
                recommended_action: { type: "STRING" },
                reasoning: { type: "STRING" },
              },
              required: [
                "id",
                "category",
                "risk_level",
                "status_assessment",
                "status_alignment",
                "criticality_score",
                "confidence",
                "requires_followup",
                "action_quality",
                "barrier_failure",
                "recommended_action",
                "reasoning",
              ],
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

  let parsed: { classifications: ClassificationResult[] };
  try {
    parsed = JSON.parse(text);
  } catch (_e) {
    throw new Error(`Invalid JSON from Gemini: ${text.slice(0, 200)}`);
  }

  return parsed.classifications ?? [];
}

function toNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeResult(card: ObsCardRow, result?: Partial<ClassificationResult>) {
  const riskLevel = RISK_LEVELS.includes(result?.risk_level as any) ? result!.risk_level : "medium";
  const statusAssessment = STATUS_ASSESSMENTS.includes(result?.status_assessment as any)
    ? result!.status_assessment
    : "UNCLEAR";
  const statusAlignment = STATUS_ALIGNMENTS.includes(result?.status_alignment as any)
    ? result!.status_alignment
    : "insufficient_info";
  const actionQuality = ACTION_QUALITIES.includes(result?.action_quality as any)
    ? result!.action_quality
    : "none";
  const barrierFailure = BARRIER_FAILURES.includes(result?.barrier_failure as any)
    ? result!.barrier_failure
    : "other";

  return {
    ai_category: CATEGORIES.includes(result?.category as any) ? result!.category : "Ato inseguro",
    ai_risk_level: riskLevel,
    ai_reasoning: String(result?.reasoning || "Analise automatica sem justificativa detalhada.").slice(0, 600),
    ai_status_assessment: statusAssessment,
    ai_status_alignment: statusAlignment,
    ai_confidence: toNumber(result?.confidence, 0.5, 0, 1),
    ai_criticality_score: Math.round(toNumber(result?.criticality_score, riskLevel === "critical" ? 5 : 3, 1, 5)),
    ai_requires_followup: Boolean(result?.requires_followup ?? statusAssessment === "UNSAFE"),
    ai_action_quality: actionQuality,
    ai_barrier_failure: barrierFailure,
    ai_recommended_action: String(
      result?.recommended_action ||
        (card.status === "UNSAFE"
          ? "Revisar a condicao, definir responsavel e registrar acao corretiva."
          : "Manter controle e compartilhar aprendizado quando aplicavel."),
    ).slice(0, 800),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY nao configurado. Adicione a secret no projeto Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const datasetId = body.dataset_id ?? body.datasetId;
    const reclassify = body.reclassify === true;
    const batchSize = Math.max(1, Math.min(60, Number(body.batch_size) || 30));
    const cardIds = Array.isArray(body.card_ids) ? body.card_ids.filter(Boolean).slice(0, batchSize) : [];

    if (!datasetId) {
      return new Response(JSON.stringify({ error: "dataset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: dataset }, { data: platformOwner }, { data: adminMasterRoles }, { data: memberships }] = await Promise.all([
      supabase.from("obs_card_datasets").select("organization_id").eq("id", datasetId).maybeSingle(),
      supabase.from("platform_owners").select("id").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_roles").select("organization_id").eq("user_id", user.id).eq("role", "admin_master"),
      supabase.from("user_organizations").select("organization_id").eq("user_id", user.id),
    ]);

    if (!dataset) {
      return new Response(JSON.stringify({ error: "Dataset not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasAdminMasterRole = !!adminMasterRoles?.length;
    const belongsToDatasetOrganization = memberships?.some(
      (membership) => membership.organization_id === dataset.organization_id,
    );
    const isDatasetAdmin = hasAdminMasterRole && belongsToDatasetOrganization;
    if (!platformOwner && !isDatasetAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: withinRateLimit } = await supabase.rpc("consume_edge_rate_limit", {
      _subject_id: user.id,
      _action: "classify-obs-cards",
      _limit: 120,
      _window_seconds: 60,
    });
    if (!withinRateLimit) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const resetPayload = {
      ai_category: null,
      ai_risk_level: null,
      ai_reasoning: null,
      ai_status_assessment: null,
      ai_status_alignment: null,
      ai_confidence: null,
      ai_criticality_score: null,
      ai_requires_followup: null,
      ai_action_quality: null,
      ai_barrier_failure: null,
      ai_recommended_action: null,
    };

    if (reclassify) {
      let resetQuery = supabase.from("obs_cards").update(resetPayload).eq("dataset_id", datasetId);
      if (cardIds.length > 0) resetQuery = resetQuery.in("id", cardIds);
      await resetQuery;
    }

    let countQuery = supabase
      .from("obs_cards")
      .select("id", { count: "exact", head: true })
      .eq("dataset_id", datasetId)
      .is("ai_category", null);
    if (cardIds.length > 0) countQuery = countQuery.in("id", cardIds);
    const { count: pendingBefore } = await countQuery;

    let cardsQuery = supabase
      .from("obs_cards")
      .select("id, obs_type, status, description, action_taken")
      .eq("dataset_id", datasetId)
      .is("ai_category", null)
      .limit(batchSize);
    if (cardIds.length > 0) cardsQuery = cardsQuery.in("id", cardIds);

    const { data: cards, error: fetchError } = await cardsQuery;
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

      const updatePromises = cards.map((card) => {
        const update = normalizeResult(card, byId.get(card.id));
        processed++;
        return supabase.from("obs_cards").update(update).eq("id", card.id);
      });
      const updates = await Promise.all(updatePromises);
      const firstErr = updates.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
    } catch (err) {
      const msg = serializeError(err);
      console.error("Batch failed:", msg, err);
      return new Response(
        JSON.stringify({ error: msg, processed: 0, remaining: pendingBefore ?? cards.length }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const remaining = Math.max(0, (pendingBefore ?? cards.length) - processed);
    return new Response(
      JSON.stringify({ success: true, processed, remaining, done: remaining === 0 }),
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
    const parts = [e.message, e.details, e.hint, e.code].filter(Boolean).map(String);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
