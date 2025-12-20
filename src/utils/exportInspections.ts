import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InspectionWithDetails } from '@/hooks/useInspections';
import {
  SBM_BLUE,
  DARK_GRAY,
  LIGHT_GRAY,
  MEDIUM_GRAY,
  SUCCESS_GREEN,
  DANGER_RED,
  WARNING_YELLOW,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  preloadLogo,
} from './pdfStyles';

const statusLabels: Record<string, string> = {
  approved: 'Aprovado',
  pending: 'Pendente',
  rejected: 'Reprovado',
  conditional: 'Condicional',
};

export function exportInspectionsToExcel(inspections: InspectionWithDetails[], filename = 'inspecoes') {
  const data = inspections.map(item => ({
    'Data Inspeção': format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
    'Equipamento': item.equipment?.name || '—',
    'Código': item.equipment?.internal_code || '—',
    'Inspetor': item.profiles?.full_name || '—',
    'Email Inspetor': item.profiles?.email || '—',
    'Status': statusLabels[item.status] || item.status,
    'Observações': item.observations || '—',
    'Recomendações': item.recommendations || '—',
    'Próxima Inspeção': item.next_inspection_date 
      ? format(new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: ptBR }) 
      : '—',
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inspeções');
  
  // Auto-size columns
  const maxWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length).slice(0, 50))
  }));
  ws['!cols'] = maxWidths;

  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function exportInspectionsToPDF(inspections: InspectionWithDetails[], filename = 'relatorio_inspecoes') {
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF('landscape');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO DE INSPEÇÕES',
    `Gerado em: ${generatedDate}`,
    [`Total: ${inspections.length} inspeções`]
  );

  // Summary
  const approved = inspections.filter(i => i.status === 'approved').length;
  const rejected = inspections.filter(i => i.status === 'rejected').length;
  const pending = inspections.filter(i => i.status === 'pending').length;
  
  // Add summary section
  yPos = addSectionHeader(doc, yPos, 'RESUMO', SBM_BLUE);
  yPos += 2;
  
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Aprovadas: ${approved} | Reprovadas: ${rejected} | Pendentes: ${pending}`, 14, yPos + 4);
  yPos += 12;

  const tableData = inspections.map(item => [
    format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
    item.equipment?.name || '—',
    item.equipment?.internal_code || '—',
    item.profiles?.full_name || '—',
    statusLabels[item.status] || item.status,
    item.observations?.substring(0, 50) || '—',
    item.next_inspection_date 
      ? format(new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: ptBR }) 
      : '—',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      'Data',
      'Equipamento',
      'Código',
      'Inspetor',
      'Status',
      'Observações',
      'Próxima'
    ]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: SBM_BLUE },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add standardized footer
  addPDFFooter(
    doc,
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório de Inspeções - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export async function exportSingleInspectionPDF(
  inspection: InspectionWithDetails, 
  checklistItems: { description: string; status: string; notes: string | null }[] = []
) {
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO DE INSPEÇÃO',
    `Documento: INS-${inspection.id.substring(0, 8).toUpperCase()}`,
    [`Emitido: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`]
  );
  
  // Inspection info section
  yPos = addSectionHeader(doc, yPos, 'DADOS DA INSPEÇÃO', SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Data: ${format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPos);
  doc.text(`Status: ${statusLabels[inspection.status] || inspection.status}`, 100, yPos);
  yPos += 6;
  doc.text(`Inspetor: ${inspection.profiles?.full_name || '—'}`, 14, yPos);
  doc.text(`Email: ${inspection.profiles?.email || '—'}`, 100, yPos);
  yPos += 10;
  
  // Equipment info section
  yPos = addSectionHeader(doc, yPos, 'EQUIPAMENTO', SBM_BLUE);
  yPos += 4;
  
  doc.text(`Nome: ${inspection.equipment?.name || '—'}`, 14, yPos);
  doc.text(`Código: ${inspection.equipment?.internal_code || '—'}`, 100, yPos);
  yPos += 10;
  
  // Checklist section
  if (checklistItems.length > 0) {
    yPos = addSectionHeader(doc, yPos, 'CHECKLIST DE INSPEÇÃO', SBM_BLUE);
    
    const checklistStatusLabels: Record<string, string> = {
      ok: 'Conforme',
      fail: 'Não Conforme',
      pending: 'Pendente',
    };
    
    autoTable(doc, {
      startY: yPos + 2,
      head: [['Item', 'Status', 'Observações']],
      body: checklistItems.map(item => [
        item.description,
        checklistStatusLabels[item.status] || item.status,
        item.notes || '—'
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: SBM_BLUE },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Observations section
  if (inspection.observations) {
    yPos = addSectionHeader(doc, yPos, 'OBSERVAÇÕES', SBM_BLUE);
    yPos += 4;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(inspection.observations, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 6;
  }
  
  // Recommendations section
  if (inspection.recommendations) {
    yPos = addSectionHeader(doc, yPos, 'RECOMENDAÇÕES', SBM_BLUE);
    yPos += 4;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(inspection.recommendations, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 6;
  }

  // Add standardized footer
  addPDFFooter(
    doc,
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório de Inspeção - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  doc.save(`inspecao_${inspection.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
