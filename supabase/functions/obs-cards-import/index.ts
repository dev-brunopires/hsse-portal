import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------- helpers ----------
const norm = (s: string) =>
  (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FIELD_ALIASES: Record<string, string[]> = {
  obs_type: ["tipo", "tipo de observacao", "tipo observacao", "type", "obs type", "category type", "bco pso", "categoria principal"],
  status: ["status", "condicao", "condition", "safe unsafe", "classificacao"],
  creation_date: ["data", "data criacao", "creation date", "data de criacao", "created", "data abertura", "data observacao"],
  area: ["area", "local", "location", "place", "setor"],
  department: ["departamento", "department", "depto", "area responsavel", "responsible area"],
  description: ["descricao", "description", "observacao", "comentario", "details", "detalhes", "what", "o que"],
  action_taken: ["acao", "acao tomada", "action taken", "corrective action", "acao corretiva", "tratativa"],
  responsible: ["responsavel", "responsible", "owner", "dono", "encarregado"],
  due_date: ["prazo", "due date", "data prazo", "vencimento"],
  close_date: ["data fechamento", "close date", "closed", "encerramento", "data encerramento"],
};

function detectMapping(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const h of headers) {
      if (used.has(h)) continue;
      const nh = norm(h);
      if (aliases.some((a) => nh === norm(a) || nh.includes(norm(a)))) {
        map[field] = h;
        used.add(h);
        break;
      }
    }
  }
  return map;
}

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // dd/mm/yyyy
  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (br) {
    const [_, d, m, y] = br;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function normalizeType(v: any): string | null {
  if (!v) return null;
  const s = norm(String(v));
  if (s.includes("bco") || s.includes("behavior") || s.includes("comportament")) return "BCO";
  if (s.includes("pso") || s.includes("process") || s.includes("equipamento") || s.includes("equipment")) return "PSO";
  return null;
}

function normalizeStatus(v: any): string | null {
  if (!v) return null;
  const s = norm(String(v));
  if (s.includes("unsafe") || s.includes("insegur") || s.includes("nao seguro") || s.includes("nao conforme")) return "UNSAFE";
  if (s.includes("safe") || s.includes("segur") || s.includes("conforme") || s.includes("ok")) return "SAFE";
  return null;
}

function deriveCategory(desc: string): string {
  const d = norm(desc);
  if (/(epi|ppe|capacete|luva|cinto|helmet|glove|harness|protect)/.test(d)) return "EPI";
  if (/(housekeep|organiza|limpeza|ordem|5s)/.test(d)) return "Housekeeping";
  if (/(queda|drop|objeto|falling)/.test(d)) return "Dropped Objects";
  if (/(equipamento|equipment|maquina|tool|ferramenta)/.test(d)) return "Equipment";
  if (/(processo|process|procedimento|procedure|operacao)/.test(d)) return "Process";
  if (/(comportament|behavior|attitude|atitude)/.test(d)) return "Behavior";
  return "Other";
}

function deriveSeverity(type: string | null, status: string | null, desc: string): string {
  const d = norm(desc);
  const isHighWord = /(critic|grav|severe|fatal|risco alto|alto risco|high risk|fire|incendio|explos)/.test(d);
  if (isHighWord) return "high";
  if (type === "PSO" && status === "UNSAFE") return "high";
  if (status === "UNSAFE") return "medium";
  return "low";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // Permission check
    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: isAdminMaster }, { data: isPO }] = await Promise.all([
      admin.rpc("is_admin_master", { _user_id: userId }),
      admin.rpc("is_platform_owner", { _user_id: userId }),
    ]);
    if (!isAdminMaster && !isPO) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { dataset_id, storage_path } = body as { dataset_id: string; storage_path: string };
    if (!dataset_id || !storage_path) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: dataset, error: dErr } = await admin
      .from("obs_card_datasets")
      .select("id, organization_id")
      .eq("id", dataset_id)
      .single();
    if (dErr || !dataset) throw new Error("dataset_not_found");

    // Download file
    const { data: file, error: fErr } = await admin.storage
      .from("obs-cards-uploads")
      .download(storage_path);
    if (fErr || !file) throw new Error(`download_failed: ${fErr?.message}`);

    const buf = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: null });
    if (!rows.length) throw new Error("empty_sheet");

    const headers = Object.keys(rows[0]);
    const mapping = detectMapping(headers);

    // Profile name
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("user_id", userId)
      .maybeSingle();

    const records = rows.map((row) => {
      const get = (f: string) => (mapping[f] ? row[mapping[f]] : null);
      const obs_type = normalizeType(get("obs_type")) || normalizeType(get("description")) || "BCO";
      const status = normalizeStatus(get("status")) || (obs_type === "PSO" ? "UNSAFE" : "SAFE");
      const creation_date = parseDate(get("creation_date"));
      const close_date = parseDate(get("close_date"));
      const due_date = parseDate(get("due_date"));
      const description = (get("description") ?? "").toString();
      const ttc =
        creation_date && close_date
          ? Math.max(
              0,
              Math.round(
                (new Date(close_date).getTime() - new Date(creation_date).getTime()) /
                  86400000,
              ),
            )
          : null;
      const dateObj = creation_date ? new Date(creation_date) : null;
      return {
        dataset_id,
        organization_id: dataset.organization_id,
        obs_type,
        status,
        creation_date,
        area: (get("area") ?? "").toString() || null,
        department: (get("department") ?? "").toString() || null,
        description: description || null,
        action_taken: (get("action_taken") ?? "").toString() || null,
        responsible: (get("responsible") ?? "").toString() || null,
        due_date,
        close_date,
        category: deriveCategory(description),
        severity: deriveSeverity(obs_type, status, description),
        time_to_close_days: ttc,
        is_open: !close_date,
        month: dateObj ? dateObj.getUTCMonth() + 1 : null,
        year: dateObj ? dateObj.getUTCFullYear() : null,
        raw_row: row,
      };
    });

    // Bulk insert in chunks
    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      const { error: insErr } = await admin.from("obs_cards").insert(chunk);
      if (insErr) throw new Error(`insert_failed: ${insErr.message}`);
      inserted += chunk.length;
    }

    await admin
      .from("obs_card_datasets")
      .update({
        status: "ready",
        row_count: inserted,
        column_mapping: mapping,
        uploaded_by: userId,
        uploaded_by_name: profile?.full_name || null,
      })
      .eq("id", dataset_id);

    return new Response(
      JSON.stringify({ success: true, inserted, mapping }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      const body = await req.clone().json();
      if (body?.dataset_id) {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await admin
          .from("obs_card_datasets")
          .update({ status: "failed", error_message: msg })
          .eq("id", body.dataset_id);
      }
    } catch (_) {}
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
