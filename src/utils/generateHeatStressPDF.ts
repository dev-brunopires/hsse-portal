import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import {
  SBM_BLUE,
  DARK_GRAY,
  LIGHT_GRAY,
  MEDIUM_GRAY,
  BORDER_GRAY,
  SUCCESS_GREEN,
  WARNING_YELLOW,
  DANGER_RED,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  preloadLogo,
} from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

export interface HeatStressPDFData {
  shipName: string;
  sector: string;
  environmentType: 'no_solar' | 'with_solar';
  metabolicRate: number;
  readings: Array<{ tbn: number; tg: number; tbs: number | null }>;
  avgTbn: number;
  avgTg: number;
  avgTbs: number | null;
  ibutg: number;
  nhoStatus: 'normal' | 'action' | 'above_limit';
  inspectorName?: string;
  measuredAt: string;
  notes?: string | null;
  branding?: OrganizationBranding;
  details?: {
    evaluation_at?: string;
    expiration_date?: string;
    ptw_number?: string;
    main_activity?: string;
    evaluator_name?: string;
    additional_info?: string;
    confined_or_artificial?: 'yes' | 'no';
    heat_index?: {
      temperature_c?: number | null;
      relative_humidity?: number | null;
      value?: number | null;
      potential_risk?: string | null;
    };
    monitor?: {
      manufacturer?: string;
      model?: string;
      serial_number?: string;
      calibration_date?: string;
    };
    clothing?: {
      type: string;
      increment: number;
    };
    corrected_ibutg?: number;
    action_level?: number;
    exposure_limit?: number;
    ceiling_value?: number | null;
    conclusion?: string;
    control_measures?: string;
  } | null;
}

const STATUS_COLOR: Record<HeatStressPDFData['nhoStatus'], [number, number, number]> = {
  normal: SUCCESS_GREEN,
  action: WARNING_YELLOW,
  above_limit: DANGER_RED,
};

const STATUS_KEY: Record<HeatStressPDFData['nhoStatus'], string> = {
  normal: 'statusNormal',
  action: 'statusAction',
  above_limit: 'statusAboveLimit',
};

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number;
  };
};

export async function generateHeatStressPDF(data: HeatStressPDFData): Promise<jsPDF> {
  const t = (k: string, opts?: Record<string, unknown>) => i18n.t(`heatStress.pdf.${k}`, opts) as string;
  const dateLocale = (i18n.language || '').toLowerCase().startsWith('pt') ? ptBR : enUS;
  const dateFmt = dateLocale === ptBR ? 'dd/MM/yyyy HH:mm' : 'yyyy-MM-dd HH:mm';

  const envLabel = data.environmentType === 'with_solar' ? t('envWithSolar') : t('envNoSolar');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const autoTableDoc = doc as JsPdfWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const lastTableY = () => autoTableDoc.lastAutoTable?.finalY ?? y;

  await preloadLogo(data.branding);

  let y = await addPDFHeader(
    doc,
    t('title'),
    t('subtitle'),
    [
      `${t('headerShip')}: ${data.shipName}`,
      `${t('headerSector')}: ${data.sector}`,
      `${t('headerDate')}: ${format(new Date(data.measuredAt), dateFmt, { locale: dateLocale })}`,
    ],
    { branding: data.branding },
  );

  y += 4;

  // ===== INFORMAÇÕES GERAIS =====
  y = addSectionHeader(doc, y, t('sectionGeneral'));
  y += 2;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, textColor: DARK_GRAY, lineColor: BORDER_GRAY },
    headStyles: { fillColor: LIGHT_GRAY, textColor: DARK_GRAY, fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, fillColor: LIGHT_GRAY },
      1: { cellWidth: 'auto' },
    },
    body: [
      [t('rowShip'), data.shipName],
      [t('rowSector'), data.sector],
      [t('rowEnv'), envLabel],
      [t('rowMetabolic'), `${data.metabolicRate.toFixed(0)} W`],
      [t('rowResponsible'), data.inspectorName || '—'],
      [t('rowDateTime'), format(new Date(data.measuredAt), dateFmt, { locale: dateLocale })],
    ],
    margin: { left: margin, right: margin },
  });
  y = lastTableY() + 6;

  if (data.details) {
    y = addSectionHeader(doc, y, 'Dados complementares da avaliação');
    y += 2;
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: DARK_GRAY, lineColor: BORDER_GRAY },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 52, fillColor: LIGHT_GRAY },
        1: { cellWidth: 'auto' },
      },
      body: [
        ['Atividade principal', data.details.main_activity || '—'],
        ['PtW nº', data.details.ptw_number || '—'],
        ['Avaliador responsável', data.details.evaluator_name || data.inspectorName || '—'],
        ['Vencimento da avaliação', data.details.expiration_date ? format(new Date(`${data.details.expiration_date}T00:00:00`), 'dd/MM/yyyy', { locale: dateLocale }) : '—'],
        ['Espaço confinado/fontes artificiais', data.details.confined_or_artificial === 'yes' ? 'Sim' : data.details.confined_or_artificial === 'no' ? 'Não' : '—'],
        ['Índice de calor', data.details.heat_index?.value != null ? `${data.details.heat_index.value} °C (${data.details.heat_index.potential_risk || '-'})` : '—'],
        ['Monitor', [data.details.monitor?.manufacturer, data.details.monitor?.model, data.details.monitor?.serial_number].filter(Boolean).join(' / ') || '—'],
        ['Calibração', data.details.monitor?.calibration_date ? format(new Date(`${data.details.monitor.calibration_date}T00:00:00`), 'dd/MM/yyyy', { locale: dateLocale }) : '—'],
      ],
      margin: { left: margin, right: margin },
    });
    y = lastTableY() + 6;
  }

  // ===== LEITURAS =====
  y = addSectionHeader(doc, y, t('sectionReadings', { count: data.readings.length }));
  y += 2;

  const head = data.environmentType === 'with_solar'
    ? [[t('colN'), t('colTbn'), t('colTg'), t('colTbs')]]
    : [[t('colN'), t('colTbn'), t('colTg')]];

  const body = data.readings.map((r, i) => {
    const base = [String(i + 1), r.tbn.toFixed(1), r.tg.toFixed(1)];
    return data.environmentType === 'with_solar'
      ? [...base, r.tbs != null ? r.tbs.toFixed(1) : '—']
      : base;
  });

  // Linha de média em destaque
  const avgRow = data.environmentType === 'with_solar'
    ? [t('avgRow'), data.avgTbn.toFixed(2), data.avgTg.toFixed(2), data.avgTbs != null ? data.avgTbs.toFixed(2) : '—']
    : [t('avgRow'), data.avgTbn.toFixed(2), data.avgTg.toFixed(2)];

  autoTable(doc, {
    startY: y,
    head,
    body: [...body, avgRow],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'center', textColor: DARK_GRAY, lineColor: BORDER_GRAY },
    headStyles: { fillColor: SBM_BLUE, textColor: [255, 255, 255], fontStyle: 'bold' },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.row.index === body.length) {
        hook.cell.styles.fillColor = LIGHT_GRAY;
        hook.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: margin, right: margin },
  });
  y = lastTableY() + 6;

  // ===== RESULTADO IBUTG =====
  y = addSectionHeader(doc, y, t('sectionResult'));
  y += 4;

  const boxW = pageWidth - margin * 2;
  const boxH = 28;
  doc.setFillColor(...LIGHT_GRAY);
  doc.setDrawColor(...BORDER_GRAY);
  doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'FD');

  // IBUTG valor
  doc.setTextColor(...MEDIUM_GRAY);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(t('ibutgLabel'), margin + 6, y + 7);

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.ibutg.toFixed(2)} °C`, margin + 6, y + 19);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  const formula = data.environmentType === 'with_solar' ? t('formulaWithSolar') : t('formulaNoSolar');
  doc.text(formula, margin + 6, y + 25);

  // Status badge (lado direito)
  const statusColor = STATUS_COLOR[data.nhoStatus];
  const badgeW = 65;
  const badgeH = 14;
  const badgeX = margin + boxW - badgeW - 6;
  const badgeY = y + (boxH - badgeH) / 2;
  doc.setFillColor(...statusColor);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(t(STATUS_KEY[data.nhoStatus]), badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: 'center' });

  y += boxH + 8;

  if (data.details?.corrected_ibutg != null) {
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.2, textColor: DARK_GRAY, lineColor: BORDER_GRAY },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 52, fillColor: LIGHT_GRAY },
        1: { cellWidth: 'auto' },
      },
      body: [
        ['Vestimenta', data.details.clothing?.type || '—'],
        ['Incremento ao IBUTG', data.details.clothing ? `+${data.details.clothing.increment} °C` : '—'],
        ['IBUTG corrigido', `${data.details.corrected_ibutg.toFixed(2)} °C`],
        ['Nível de ação', data.details.action_level != null ? `${data.details.action_level.toFixed(1)} °C` : '—'],
        ['Limite de exposição', data.details.exposure_limit != null ? `${data.details.exposure_limit.toFixed(1)} °C` : '—'],
        ['Valor teto', data.details.ceiling_value != null ? `${data.details.ceiling_value.toFixed(1)} °C` : '—'],
        ['Conclusão', data.details.conclusion || '—'],
      ],
      margin: { left: margin, right: margin },
    });
    y = lastTableY() + 6;
  }

  // ===== OBSERVAÇÕES =====
  if (data.notes) {
    y = addSectionHeader(doc, y, t('sectionNotes'));
    y += 4;
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
  }

  if (data.details?.control_measures) {
    y = addSectionHeader(doc, y, 'Medidas de Controle');
    y += 4;
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const controlLines = doc.splitTextToSize(data.details.control_measures, pageWidth - margin * 2);
    doc.text(controlLines, margin, y);
    y += controlLines.length * 4.5 + 4;
  }

  // ===== NOTA METODOLÓGICA =====
  y += 2;
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;
  doc.setTextColor(...MEDIUM_GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const noteLines = doc.splitTextToSize(t('methodNote'), pageWidth - margin * 2);
  doc.text(noteLines, margin, y);

  // Footer
  addPDFFooter(
    doc,
    data.branding?.name || 'HSSE Connect',
    t('footerTitle', { ship: data.shipName }),
  );

  return doc;
}

export async function downloadHeatStressPDF(data: HeatStressPDFData) {
  const doc = await generateHeatStressPDF(data);
  const base = (i18n.t('heatStress.pdf.fileName') as string) || 'heat-stress';
  const filename = `${base}_${data.shipName.replace(/\s+/g, '-')}_${format(new Date(data.measuredAt), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
}

