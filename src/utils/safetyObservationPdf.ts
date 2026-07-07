import jsPDF from 'jspdf';
import type { SafetyObservationWithShip, SafetyRiskLevel } from '@/hooks/useSafetyObservations';
import { formatDateTime } from '@/utils/dateFormat';

const riskLabel: Record<SafetyRiskLevel, string> = {
  low: 'Baixo',
  medium: 'Médio',
  high: 'Alto',
  critical: 'Crítico',
};

const statusLabel: Record<SafetyObservationWithShip['status'], string> = {
  open: 'Aberta',
  in_progress: 'Em andamento',
  closed: 'Concluída',
};

function addWrapped(doc: jsPDF, label: string, value: string | null | undefined, x: number, y: number, width: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(value || '-', width);
  doc.text(lines, x, y + 5);
  return y + 10 + (lines.length - 1) * 5;
}

export function downloadSafetyObservationPDF(observation: SafetyObservationWithShip) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  doc.setFillColor(0, 74, 143);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Observação de Segurança', margin, 17);

  doc.setTextColor(0, 0, 0);
  y = 38;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Identificação', margin, y);
  y += 8;

  const left = margin;
  const right = margin + contentWidth / 2 + 4;
  const colWidth = contentWidth / 2 - 4;
  const firstColumnY = y;
  let leftY = y;
  let rightY = y;

  leftY = addWrapped(doc, 'Navio / Unidade', observation.ships?.name || observation.ship_id, left, leftY, colWidth);
  leftY = addWrapped(doc, 'Localização', observation.area, left, leftY, colWidth);
  leftY = addWrapped(doc, 'Observador', observation.observer_name, left, leftY, colWidth);
  leftY = addWrapped(doc, 'Departamento', observation.observer_department, left, leftY, colWidth);

  rightY = addWrapped(doc, 'Data e hora', formatDateTime(observation.observed_at), right, rightY, colWidth);
  rightY = addWrapped(doc, 'Modelo', observation.card_template === 'psf' ? 'Segurança de Processo' : 'Comportamento / Condição', right, rightY, colWidth);
  rightY = addWrapped(doc, 'Status', statusLabel[observation.status], right, rightY, colWidth);
  rightY = addWrapped(doc, 'Risco', riskLabel[observation.risk_level], right, rightY, colWidth);

  y = Math.max(leftY, rightY, firstColumnY + 40) + 4;
  doc.setDrawColor(220, 226, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Observação e risco', margin, y);
  y += 8;
  y = addWrapped(doc, 'Descrição', observation.description, margin, y, contentWidth);
  y = addWrapped(doc, 'Percepção de risco', observation.risk_perception, margin, y, contentWidth);
  y = addWrapped(doc, 'Consequência potencial', observation.potential_consequence, margin, y, contentWidth);
  y = addWrapped(doc, 'Ação imediata / intervenção', observation.immediate_action, margin, y, contentWidth);

  if (y > 235) {
    doc.addPage();
    y = 18;
  }

  doc.setDrawColor(220, 226, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Tratativa', margin, y);
  y += 8;
  y = addWrapped(doc, 'Ação recomendada', observation.recommended_action, margin, y, contentWidth);
  y = addWrapped(doc, 'Responsável', observation.responsible_name, margin, y, contentWidth);
  y = addWrapped(doc, 'Prazo', observation.due_date ? new Date(`${observation.due_date}T00:00:00`).toLocaleDateString('pt-BR') : null, margin, y, contentWidth);
  y = addWrapped(doc, 'Aprendizado', observation.learning, margin, y, contentWidth);

  const flags = [
    observation.stop_work && 'Stop Work exercido',
    observation.fatality_potential && 'Potencial de fatalidade',
    observation.requires_followup && 'Acompanhamento requerido',
    observation.requires_cmms && 'CMMS requerido',
    observation.requires_investigation && 'Investigação requerida',
    observation.share_in_tbt && 'Compartilhar em TBT',
  ].filter(Boolean).join(' | ');
  addWrapped(doc, 'Marcadores', flags || '-', margin, y, contentWidth);

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`observacao-seguranca_${stamp}_${observation.id.slice(0, 8)}.pdf`);
}
