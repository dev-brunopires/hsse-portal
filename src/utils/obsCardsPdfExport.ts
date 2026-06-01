import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  SBM_BLUE,
  DARK_GRAY,
  LIGHT_GRAY,
  MEDIUM_GRAY,
  SUCCESS_GREEN,
  WARNING_YELLOW,
  DANGER_RED,
  BORDER_GRAY,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  preloadLogo,
} from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import type { ObsCard } from '@/hooks/useObsCards';
import i18n from '@/i18n';

const getDateLocale = () => (i18n.language === 'en' ? enUS : ptBR);

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_COLORS: Record<RiskLevel, [number, number, number]> = {
  low: SUCCESS_GREEN,
  medium: WARNING_YELLOW,
  high: [234, 88, 12], // orange
  critical: DANGER_RED,
};

export interface ObsCardsPdfFilters {
  datasetName: string;
  branding?: OrganizationBranding;
  /** When set, restrict report to one area/department (sectorized). */
  sectorLabel?: string;
}

function getRiskTypeOf(c: ObsCard): string {
  return c.ai_category || c.category || '—';
}

function formatMonthYear(year: number | null, month: number | null): string {
  if (!year || !month) return '—';
  const d = new Date(year, month - 1, 1);
  return format(d, 'MMM/yyyy', { locale: getDateLocale() });
}

interface KPI {
  label: string;
  value: string;
  color: [number, number, number];
}

function drawKpiRow(doc: jsPDF, yPos: number, kpis: KPI[], pageWidth: number): number {
  const kpiWidth = (pageWidth - 28 - 4 * (kpis.length - 1)) / kpis.length;
  kpis.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 4) * index;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDER_GRAY);
    doc.roundedRect(xPos, yPos, kpiWidth, 22, 3, 3, 'FD');
    doc.setFillColor(...kpi.color);
    doc.roundedRect(xPos, yPos, 4, 22, 2, 0, 'F');
    doc.rect(xPos + 2, yPos, 2, 22, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 9, yPos + 11);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(kpi.label, xPos + 9, yPos + 18);
  });
  return yPos + 26;
}

/** Renders a horizontal bar chart natively in jsPDF (no canvas dependency). */
function drawHorizontalBars(
  doc: jsPDF,
  yPos: number,
  data: Array<{ name: string; value: number }>,
  options: { width: number; barHeight?: number; color?: [number, number, number]; max?: number },
): number {
  const barHeight = options.barHeight ?? 6;
  const labelWidth = 60;
  const valueWidth = 14;
  const trackX = 14 + labelWidth;
  const trackWidth = options.width - labelWidth - valueWidth - 14;
  const max = options.max ?? Math.max(1, ...data.map((d) => d.value));
  const color = options.color ?? SBM_BLUE;

  data.forEach((d, i) => {
    const rowY = yPos + i * (barHeight + 4);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    const label = d.name.length > 30 ? d.name.slice(0, 28) + '…' : d.name;
    doc.text(label, 14, rowY + barHeight - 1);
    // Track
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(trackX, rowY, trackWidth, barHeight, 'F');
    // Bar
    const w = Math.max(1, (d.value / max) * trackWidth);
    doc.setFillColor(...color);
    doc.rect(trackX, rowY, w, barHeight, 'F');
    // Value
    doc.setTextColor(...DARK_GRAY);
    doc.text(String(d.value), trackX + trackWidth + 2, rowY + barHeight - 1);
  });
  return yPos + data.length * (barHeight + 4) + 4;
}

function groupCount<T>(items: T[], key: (i: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const it of items) {
    const k = (key(it) || '—').trim() || '—';
    map.set(k, (map.get(k) || 0) + 1);
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

function monthlyAggregation(cards: ObsCard[]) {
  const map = new Map<string, { name: string; total: number; bco: number; pso: number; unsafe: number }>();
  for (const c of cards) {
    if (!c.year || !c.month) continue;
    const key = `${c.year}-${String(c.month).padStart(2, '0')}`;
    const display = formatMonthYear(c.year, c.month);
    if (!map.has(key)) map.set(key, { name: display, total: 0, bco: 0, pso: 0, unsafe: 0 });
    const e = map.get(key)!;
    e.total++;
    if (c.obs_type === 'BCO') e.bco++;
    if (c.obs_type === 'PSO') e.pso++;
    if (c.status === 'UNSAFE') e.unsafe++;
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

async function buildReport(
  cards: ObsCard[],
  filters: ObsCardsPdfFilters,
): Promise<jsPDF> {
  const t = i18n.t;
  const dateLocale = getDateLocale();
  await preloadLogo(filters.branding);

  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: dateLocale });

  const titleSuffix = filters.sectorLabel
    ? ` — ${filters.sectorLabel}`
    : ` — ${t('obsCards.pdf.consolidated')}`;

  let yPos = await addPDFHeader(
    doc,
    `${t('obsCards.pdf.title')}${titleSuffix}`,
    `${t('obsCards.pdf.generatedAt')}: ${generatedAt}`,
    [`${t('obsCards.pdf.dataset')}: ${filters.datasetName}`],
    { branding: filters.branding },
  );

  // ===== KPIs
  const total = cards.length;
  const safe = cards.filter((c) => c.status === 'SAFE').length;
  const unsafe = cards.filter((c) => c.status === 'UNSAFE').length;
  const open = cards.filter((c) => c.is_open).length;
  const bco = cards.filter((c) => c.obs_type === 'BCO').length;
  const pso = cards.filter((c) => c.obs_type === 'PSO').length;
  const critical = cards.filter((c) => c.ai_risk_level === 'critical').length;
  const high = cards.filter((c) => c.ai_risk_level === 'high').length;

  yPos = addSectionHeader(doc, yPos, t('obsCards.pdf.executiveSummary'), SBM_BLUE, pageWidth - 28);
  yPos += 4;
  yPos = drawKpiRow(doc, yPos, [
    { label: t('obsCards.kpis.total'), value: String(total), color: SBM_BLUE },
    { label: t('obsCards.kpis.safe'), value: String(safe), color: SUCCESS_GREEN },
    { label: t('obsCards.kpis.unsafe'), value: String(unsafe), color: DANGER_RED },
    { label: t('obsCards.kpis.open'), value: String(open), color: WARNING_YELLOW },
    { label: 'BCO', value: String(bco), color: SBM_BLUE },
    { label: 'PSO', value: String(pso), color: SBM_BLUE },
    { label: t('obsCards.pdf.kpiCritical'), value: String(critical), color: DANGER_RED },
    { label: t('obsCards.pdf.kpiHigh'), value: String(high), color: RISK_COLORS.high },
  ], pageWidth);

  // ===== Risk types
  yPos += 2;
  yPos = addSectionHeader(doc, yPos, t('obsCards.pdf.byRiskType'), SBM_BLUE, pageWidth - 28);
  yPos += 4;
  const byRisk = groupCount(cards, (c) => c.ai_category)
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  if (byRisk.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('obsCards.pdf.noAiData'), 14, yPos + 5);
    yPos += 10;
  } else {
    yPos = drawHorizontalBars(doc, yPos, byRisk, { width: pageWidth, color: SBM_BLUE });
  }

  // ===== Monthly trend table
  const monthly = monthlyAggregation(cards);
  if (monthly.length > 0) {
    if (yPos > 160) {
      doc.addPage();
      yPos = 20;
    }
    yPos = addSectionHeader(doc, yPos, t('obsCards.pdf.monthlyTrend'), SBM_BLUE, pageWidth - 28);
    autoTable(doc, {
      startY: yPos + 2,
      head: [[
        t('obsCards.pdf.month'),
        t('obsCards.kpis.total'),
        'BCO',
        'PSO',
        'UNSAFE',
      ]],
      body: monthly.map((m) => [m.name, m.total, m.bco, m.pso, m.unsafe]),
      theme: 'striped',
      headStyles: { fillColor: SBM_BLUE, fontSize: 8, textColor: [255, 255, 255], cellPadding: 2 },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 50;
  }

  // ===== Per-area breakdown (only on consolidated report)
  if (!filters.sectorLabel) {
    const byArea = groupCount(cards, (c) => c.area).sort((a, b) => b.value - a.value);
    if (byArea.length > 0) {
      if (yPos > 160) {
        doc.addPage();
        yPos = 20;
      }
      yPos = addSectionHeader(doc, yPos, t('obsCards.pdf.byArea'), SBM_BLUE, pageWidth - 28);
      autoTable(doc, {
        startY: yPos + 2,
        head: [[
          t('obsCards.filters.area'),
          t('obsCards.kpis.total'),
          'UNSAFE',
          t('obsCards.kpis.open'),
          t('obsCards.pdf.kpiCritical'),
        ]],
        body: byArea.slice(0, 30).map((a) => {
          const subset = cards.filter((c) => (c.area || '—') === a.name);
          return [
            a.name,
            a.value,
            subset.filter((c) => c.status === 'UNSAFE').length,
            subset.filter((c) => c.is_open).length,
            subset.filter((c) => c.ai_risk_level === 'critical').length,
          ];
        }),
        theme: 'striped',
        headStyles: { fillColor: SBM_BLUE, fontSize: 8, textColor: [255, 255, 255], cellPadding: 2 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 50;
    }
  }

  // ===== Top UNSAFE open cards
  const unsafeOpen = cards.filter((c) => c.status === 'UNSAFE' && c.is_open).slice(0, 30);
  if (unsafeOpen.length > 0) {
    doc.addPage();
    yPos = 20;
    yPos = addSectionHeader(doc, yPos, t('obsCards.pdf.openUnsafe'), DANGER_RED, pageWidth - 28);
    autoTable(doc, {
      startY: yPos + 2,
      head: [[
        t('obsCards.pdf.month'),
        t('obsCards.filters.area'),
        t('obsCards.pdf.riskType'),
        t('obsCards.pdf.riskLevel'),
        t('obsCards.pdf.description'),
      ]],
      body: unsafeOpen.map((c) => [
        formatMonthYear(c.year, c.month),
        c.area || '—',
        getRiskTypeOf(c),
        c.ai_risk_level ? t(`obsCards.riskLevel.${c.ai_risk_level}`) : '—',
        (c.description || '').slice(0, 140),
      ]),
      theme: 'striped',
      headStyles: { fillColor: DANGER_RED, fontSize: 8, textColor: [255, 255, 255], cellPadding: 2 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: { 4: { cellWidth: 100 } },
      margin: { left: 14, right: 14 },
    });
  }

  const companyName = filters.branding?.name || 'SafeShip';
  addPDFFooter(
    doc,
    t('exportDashboardPDF.footerCompany', { companyName }),
    `${t('obsCards.pdf.title')} - ${generatedAt}`,
  );

  return doc;
}

export async function exportObsCardsConsolidated(
  cards: ObsCard[],
  filters: ObsCardsPdfFilters,
) {
  const doc = await buildReport(cards, filters);
  const stamp = format(new Date(), 'yyyy-MM-dd-HHmm');
  doc.save(`obs-cards_${stamp}.pdf`);
}

export async function exportObsCardsBySector(
  cards: ObsCard[],
  sector: string,
  filters: ObsCardsPdfFilters,
) {
  const subset = cards.filter((c) => (c.area || '—') === sector);
  const doc = await buildReport(subset, { ...filters, sectorLabel: sector });
  const stamp = format(new Date(), 'yyyy-MM-dd-HHmm');
  const safe = sector.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'setor';
  doc.save(`obs-cards_${safe}_${stamp}.pdf`);
}
