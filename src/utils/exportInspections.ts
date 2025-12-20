import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { InspectionWithDetails } from '@/hooks/useInspections';

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

export function exportInspectionsToPDF(inspections: InspectionWithDetails[], filename = 'relatorio_inspecoes') {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Inspeções', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
  doc.text(`Total de inspeções: ${inspections.length}`, 14, 36);

  // Summary
  const approved = inspections.filter(i => i.status === 'approved').length;
  const rejected = inspections.filter(i => i.status === 'rejected').length;
  const pending = inspections.filter(i => i.status === 'pending').length;
  
  doc.text(`Aprovadas: ${approved} | Reprovadas: ${rejected} | Pendentes: ${pending}`, 14, 42);

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
    startY: 48,
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
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportSingleInspectionPDF(
  inspection: InspectionWithDetails, 
  checklistItems: { description: string; status: string; notes: string | null }[] = []
) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text('Relatório de Inspeção', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
  
  // Inspection info
  doc.setFontSize(12);
  doc.text('Dados da Inspeção', 14, 42);
  
  doc.setFontSize(10);
  const infoY = 50;
  doc.text(`Data: ${format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: ptBR })}`, 14, infoY);
  doc.text(`Status: ${statusLabels[inspection.status] || inspection.status}`, 14, infoY + 6);
  doc.text(`Inspetor: ${inspection.profiles?.full_name || '—'}`, 14, infoY + 12);
  doc.text(`Email: ${inspection.profiles?.email || '—'}`, 14, infoY + 18);
  
  // Equipment info
  doc.setFontSize(12);
  doc.text('Equipamento', 14, infoY + 32);
  
  doc.setFontSize(10);
  doc.text(`Nome: ${inspection.equipment?.name || '—'}`, 14, infoY + 40);
  doc.text(`Código: ${inspection.equipment?.internal_code || '—'}`, 14, infoY + 46);
  
  // Observations
  if (inspection.observations) {
    doc.setFontSize(12);
    doc.text('Observações', 14, infoY + 60);
    doc.setFontSize(10);
    const obsLines = doc.splitTextToSize(inspection.observations, 180);
    doc.text(obsLines, 14, infoY + 68);
  }
  
  // Recommendations
  if (inspection.recommendations) {
    const recY = inspection.observations ? infoY + 90 : infoY + 60;
    doc.setFontSize(12);
    doc.text('Recomendações', 14, recY);
    doc.setFontSize(10);
    const recLines = doc.splitTextToSize(inspection.recommendations, 180);
    doc.text(recLines, 14, recY + 8);
  }

  // Checklist
  if (checklistItems.length > 0) {
    const checklistY = inspection.recommendations 
      ? (inspection.observations ? 150 : 120) 
      : (inspection.observations ? 120 : 90);
    
    doc.setFontSize(12);
    doc.text('Itens do Checklist', 14, checklistY);
    
    const checklistData = checklistItems.map(item => [
      item.description,
      item.status === 'ok' ? 'OK' : item.status === 'fail' ? 'Falha' : 'Atenção',
      item.notes || '—',
    ]);

    autoTable(doc, {
      startY: checklistY + 6,
      head: [['Item', 'Status', 'Observações']],
      body: checklistData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
    });
  }

  // Next inspection
  if (inspection.next_inspection_date) {
    const pageHeight = doc.internal.pageSize.height;
    doc.setFontSize(10);
    doc.text(
      `Próxima inspeção programada: ${format(new Date(inspection.next_inspection_date), 'dd/MM/yyyy', { locale: ptBR })}`,
      14,
      pageHeight - 20
    );
  }

  doc.save(`inspecao_${inspection.equipment?.internal_code || 'relatorio'}_${format(new Date(inspection.inspection_date), 'yyyy-MM-dd')}.pdf`);
}
