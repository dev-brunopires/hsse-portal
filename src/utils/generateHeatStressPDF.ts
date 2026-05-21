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


export async function generateHeatStressPDF(data: HeatStressPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  await preloadLogo(data.branding);

  let y = await addPDFHeader(
    doc,
    'Avaliação de Heat Stress',
    'NHO 06 — FUNDACENTRO',
    [
      `Navio: ${data.shipName}`,
      `Setor: ${data.sector}`,
      `Data: ${format(new Date(data.measuredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
    ],
    { branding: data.branding },
  );

  y += 4;

  // ===== INFORMAÇÕES GERAIS =====
  y = addSectionHeader(doc, y, 'Informações Gerais');
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
      ['Navio', data.shipName],
      ['Setor / Área', data.sector],
      ['Tipo de Ambiente', ENV_LABEL[data.environmentType]],
      ['Taxa Metabólica', `${data.metabolicRate.toFixed(0)} W`],
      ['Responsável', data.inspectorName || '—'],
      ['Data / Hora da Medição', format(new Date(data.measuredAt), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ],
    margin: { left: margin, right: margin },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== LEITURAS =====
  y = addSectionHeader(doc, y, `Leituras de Temperatura (${data.readings.length})`);
  y += 2;

  const head = data.environmentType === 'with_solar'
    ? [['#', 'Tbn (°C)', 'Tg (°C)', 'Tbs (°C)']]
    : [['#', 'Tbn (°C)', 'Tg (°C)']];

  const body = data.readings.map((r, i) => {
    const base = [String(i + 1), r.tbn.toFixed(1), r.tg.toFixed(1)];
    return data.environmentType === 'with_solar'
      ? [...base, r.tbs != null ? r.tbs.toFixed(1) : '—']
      : base;
  });

  // Linha de média em destaque
  const avgRow = data.environmentType === 'with_solar'
    ? ['Média', data.avgTbn.toFixed(2), data.avgTg.toFixed(2), data.avgTbs != null ? data.avgTbs.toFixed(2) : '—']
    : ['Média', data.avgTbn.toFixed(2), data.avgTg.toFixed(2)];

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
  y = (doc as any).lastAutoTable.finalY + 6;

  // ===== RESULTADO IBUTG =====
  y = addSectionHeader(doc, y, 'Resultado IBUTG');
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
  doc.text('IBUTG CALCULADO', margin + 6, y + 7);

  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(`${data.ibutg.toFixed(2)} °C`, margin + 6, y + 19);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  const formula = data.environmentType === 'with_solar'
    ? 'Fórmula: 0,7·Tbn + 0,2·Tg + 0,1·Tbs (com carga solar)'
    : 'Fórmula: 0,7·Tbn + 0,3·Tg (sem carga solar)';
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
  doc.text(STATUS_LABEL[data.nhoStatus], badgeX + badgeW / 2, badgeY + badgeH / 2 + 1.5, { align: 'center' });

  y += boxH + 8;

  // ===== OBSERVAÇÕES =====
  if (data.notes) {
    y = addSectionHeader(doc, y, 'Observações');
    y += 4;
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(data.notes, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 4;
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
  const note = 'Avaliação baseada na Norma de Higiene Ocupacional NHO 06 da FUNDACENTRO — Avaliação da exposição ocupacional ao calor. Os limites de tolerância são interpretados conforme a taxa metabólica média informada.';
  const noteLines = doc.splitTextToSize(note, pageWidth - margin * 2);
  doc.text(noteLines, margin, y);

  // Footer
  addPDFFooter(
    doc,
    data.branding?.name || 'Portal de HSSE',
    `Heat Stress — ${data.shipName}`,
  );

  return doc;
}

export async function downloadHeatStressPDF(data: HeatStressPDFData) {
  const doc = await generateHeatStressPDF(data);
  const filename = `heat-stress_${data.shipName.replace(/\s+/g, '-')}_${format(new Date(data.measuredAt), 'yyyyMMdd-HHmm')}.pdf`;
  doc.save(filename);
}
