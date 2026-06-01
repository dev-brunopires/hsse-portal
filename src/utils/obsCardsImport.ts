import * as XLSX from 'xlsx';
import { daysBetweenLocalDates, formatLocalDate, parseLocalDate } from '@/utils/dateFormat';
import { supabase } from '@/integrations/supabase/client';
import { buildObsCardsDashboardSummary } from '@/utils/obsCardsSummary';

const INSERT_CHUNK_SIZE = 250;

type ProgressCallback = (progress: number) => void;

type ObsCardInsert = {
  dataset_id: string;
  organization_id: string;
  obs_type: string | null;
  status: string | null;
  creation_date: string | null;
  area: string | null;
  department: string | null;
  description: string | null;
  action_taken: string | null;
  responsible: string | null;
  due_date: string | null;
  close_date: string | null;
  category: string;
  severity: string;
  time_to_close_days: number | null;
  is_open: boolean;
  month: number | null;
  year: number | null;
  ship_name: string | null;
  raw_row: null;
};

const norm = (s: string) =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const FIELD_ALIASES: Record<string, string[]> = {
  obs_type: ['tipo', 'tipo de observacao', 'tipo observacao', 'type', 'obs type', 'category type', 'bco pso', 'categoria principal'],
  status: ['status', 'condicao', 'condition', 'safe unsafe', 'classificacao'],
  creation_date: ['data', 'data criacao', 'creation date', 'data de criacao', 'created', 'data abertura', 'data observacao'],
  area: ['area', 'local', 'location', 'place', 'setor'],
  department: ['departamento', 'department', 'depto', 'area responsavel', 'responsible area'],
  description: ['descricao', 'description', 'observacao', 'comentario', 'details', 'detalhes', 'what', 'o que'],
  action_taken: ['acao', 'acao tomada', 'action taken', 'corrective action', 'acao corretiva', 'tratativa'],
  responsible: ['responsavel', 'responsible', 'owner', 'dono', 'encarregado'],
  due_date: ['prazo', 'due date', 'data prazo', 'vencimento'],
  close_date: ['data fechamento', 'close date', 'closed', 'encerramento', 'data encerramento'],
  ship_name: ['navio', 'embarcacao', 'embarcação', 'vessel', 'ship', 'unidade', 'unit', 'rig'],
};

const yieldToBrowser = () => new Promise((resolve) => window.setTimeout(resolve, 0));

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

function parseDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }

  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (br) {
    const [, d, m, y] = br;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const parsed = parseLocalDate(s);
  if (parsed && !Number.isNaN(parsed.getTime())) return formatLocalDate(parsed);
  return null;
}

function normalizeType(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = norm(String(v));
  if (s.includes('bco') || s.includes('behavior') || s.includes('comportament')) return 'BCO';
  if (s.includes('pso') || s.includes('process') || s.includes('equipamento') || s.includes('equipment')) return 'PSO';
  return null;
}

function normalizeStatus(v: unknown): string | null {
  if (v == null || v === '') return null;
  const s = norm(String(v));
  if (s.includes('unsafe') || s.includes('insegur') || s.includes('nao seguro') || s.includes('nao conforme')) return 'UNSAFE';
  if (s.includes('safe') || s.includes('segur') || s.includes('conforme') || s.includes('ok')) return 'SAFE';
  return null;
}

function deriveCategory(desc: string): string {
  const d = norm(desc);
  if (/(epi|ppe|capacete|luva|cinto|helmet|glove|harness|protect)/.test(d)) return 'EPI';
  if (/(housekeep|organiza|limpeza|ordem|5s)/.test(d)) return 'Housekeeping';
  if (/(queda|drop|objeto|falling)/.test(d)) return 'Dropped Objects';
  if (/(equipamento|equipment|maquina|tool|ferramenta)/.test(d)) return 'Equipment';
  if (/(processo|process|procedimento|procedure|operacao)/.test(d)) return 'Process';
  if (/(comportament|behavior|attitude|atitude)/.test(d)) return 'Behavior';
  return 'Other';
}

function deriveSeverity(type: string | null, status: string | null, desc: string): string {
  const d = norm(desc);
  const isHighWord = /(critic|grav|severe|fatal|risco alto|alto risco|high risk|fire|incendio|explos)/.test(d);
  if (isHighWord) return 'high';
  if (type === 'PSO' && status === 'UNSAFE') return 'high';
  if (status === 'UNSAFE') return 'medium';
  return 'low';
}

function getCell(sheet: XLSX.WorkSheet, rowIndex: number, columnIndex: number): unknown {
  const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
  return cell?.v ?? null;
}

function toNullableText(value: unknown): string | null {
  const text = (value ?? '').toString();
  return text || null;
}

function buildRecord(
  row: Record<string, unknown>,
  mapping: Record<string, string>,
  datasetId: string,
  organizationId: string,
): ObsCardInsert {
  const get = (field: string) => (mapping[field] ? row[mapping[field]] : null);
  const obsType = normalizeType(get('obs_type')) || normalizeType(get('description')) || 'BCO';
  const status = normalizeStatus(get('status')) || (obsType === 'PSO' ? 'UNSAFE' : 'SAFE');
  const creationDate = parseDate(get('creation_date'));
  const closeDate = parseDate(get('close_date'));
  const dueDate = parseDate(get('due_date'));
  const description = (get('description') ?? '').toString();
  const daysToClose = daysBetweenLocalDates(creationDate, closeDate);

  return {
    dataset_id: datasetId,
    organization_id: organizationId,
    obs_type: obsType,
    status,
    creation_date: creationDate,
    area: toNullableText(get('area')),
    department: toNullableText(get('department')),
    description: description || null,
    action_taken: toNullableText(get('action_taken')),
    responsible: toNullableText(get('responsible')),
    due_date: dueDate,
    close_date: closeDate,
    category: deriveCategory(description),
    severity: deriveSeverity(obsType, status, description),
    time_to_close_days: daysToClose == null ? null : Math.max(0, daysToClose),
    is_open: !closeDate,
    month: creationDate ? Number(creationDate.slice(5, 7)) : null,
    year: creationDate ? Number(creationDate.slice(0, 4)) : null,
    raw_row: null,
  };
}

export async function importObsCardsFromFile({
  file,
  datasetId,
  organizationId,
  onProgress,
}: {
  file: File;
  datasetId: string;
  organizationId: string;
  onProgress?: ProgressCallback;
}) {
  onProgress?.(5);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const ref = sheet?.['!ref'];
  if (!sheet || !ref) throw new Error('empty_sheet');

  const range = XLSX.utils.decode_range(ref);
  const headerRow = range.s.r;
  const headerEntries: Array<{ header: string; columnIndex: number }> = [];
  for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
    const value = getCell(sheet, headerRow, columnIndex);
    const header = value == null ? '' : String(value).trim();
    if (header) headerEntries.push({ header, columnIndex });
  }

  if (!headerEntries.length) throw new Error('missing_headers');

  const mapping = detectMapping(headerEntries.map(({ header }) => header));
  const totalRows = Math.max(1, range.e.r - headerRow);
  let inserted = 0;
  let chunk: ObsCardInsert[] = [];
  const summaryRows: ObsCardInsert[] = [];

  onProgress?.(12);

  for (let rowIndex = headerRow + 1; rowIndex <= range.e.r; rowIndex += 1) {
    const row: Record<string, unknown> = {};
    let hasValue = false;

    for (const { header, columnIndex } of headerEntries) {
      const value = getCell(sheet, rowIndex, columnIndex);
      row[header] = value;
      if (value !== null && value !== '') hasValue = true;
    }

    if (hasValue) {
      const record = buildRecord(row, mapping, datasetId, organizationId);
      chunk.push(record);
      summaryRows.push(record);
    }

    if (chunk.length >= INSERT_CHUNK_SIZE || (rowIndex === range.e.r && chunk.length)) {
      const { error } = await supabase.from('obs_cards').insert(chunk);
      if (error) throw new Error(`insert_failed: ${error.message}`);
      inserted += chunk.length;
      chunk = [];
      onProgress?.(Math.min(95, 12 + Math.round(((rowIndex - headerRow) / totalRows) * 83)));
      await yieldToBrowser();
    }
  }

  if (!inserted) throw new Error('empty_sheet');
  onProgress?.(98);

  return { inserted, mapping, dashboardSummary: buildObsCardsDashboardSummary(summaryRows) };
}