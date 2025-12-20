import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InspectionPDFData {
  inspection: {
    id: string;
    inspection_date: string;
    status: string;
    observations?: string | null;
    recommendations?: string | null;
    next_inspection_date?: string | null;
    signature_data?: string | null;
    signed_at?: string | null;
  };
  equipment: {
    name: string;
    internal_code: string;
    type: string;
    manufacturer: string;
    model: string;
    serial_number: string;
    location: string;
    unit: string;
    category_name?: string;
  };
  inspector: {
    full_name: string;
    email: string;
  };
  checklistItems: Array<{
    description: string;
    status: string;
    notes?: string | null;
  }>;
}

const statusLabels: Record<string, string> = {
  compliant: 'CONFORME',
  attention: 'ATENÇÃO',
  'non-compliant': 'NÃO CONFORME',
  ok: 'Conforme',
  fail: 'Não Conforme',
  pending: 'Pendente',
};

export function generateInspectionPDF(data: InspectionPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE INSPEÇÃO', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPos, { align: 'center' });

  // Status badge
  yPos += 12;
  const status = statusLabels[data.inspection.status] || data.inspection.status;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  
  const statusColor = data.inspection.status === 'compliant' ? [34, 197, 94] : 
                      data.inspection.status === 'attention' ? [234, 179, 8] : [239, 68, 68];
  
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(pageWidth / 2 - 25, yPos - 5, 50, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(status, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  // Equipment Information
  yPos += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMAÇÕES DO EQUIPAMENTO', 14, yPos);
  
  yPos += 5;
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ['Nome:', data.equipment.name],
      ['Código Interno:', data.equipment.internal_code],
      ['Tipo:', data.equipment.type],
      ['Categoria:', data.equipment.category_name || '-'],
      ['Fabricante:', data.equipment.manufacturer],
      ['Modelo:', data.equipment.model],
      ['Número de Série:', data.equipment.serial_number],
      ['Localização:', data.equipment.location],
      ['Unidade:', data.equipment.unit],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  // Inspection Details
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALHES DA INSPEÇÃO', 14, yPos);
  
  yPos += 5;
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ['Data da Inspeção:', format(new Date(data.inspection.inspection_date), 'dd/MM/yyyy', { locale: ptBR })],
      ['Inspetor:', data.inspector.full_name],
      ['Próxima Inspeção:', data.inspection.next_inspection_date ? format(new Date(data.inspection.next_inspection_date), 'dd/MM/yyyy', { locale: ptBR }) : 'Não programada'],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
  });

  // Checklist
  yPos = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECKLIST DE VERIFICAÇÃO', 14, yPos);
  
  yPos += 5;
  const checklistBody = data.checklistItems.map((item, index) => [
    (index + 1).toString(),
    item.description,
    statusLabels[item.status] || item.status,
    item.notes || '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Item', 'Status', 'Observações']],
    body: checklistBody,
    theme: 'striped',
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 
      0: { cellWidth: 10 },
      1: { cellWidth: 70 },
      2: { cellWidth: 25 },
      3: { cellWidth: 'auto' },
    },
    headStyles: { fillColor: [59, 130, 246] },
  });

  // Observations and Recommendations
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  if (data.inspection.observations) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVAÇÕES', 14, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const obsLines = doc.splitTextToSize(data.inspection.observations, pageWidth - 28);
    doc.text(obsLines, 14, yPos);
    yPos += obsLines.length * 5 + 5;
  }

  if (data.inspection.recommendations) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RECOMENDAÇÕES', 14, yPos);
    yPos += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const recLines = doc.splitTextToSize(data.inspection.recommendations, pageWidth - 28);
    doc.text(recLines, 14, yPos);
    yPos += recLines.length * 5 + 10;
  }

  // Signature
  if (data.inspection.signature_data) {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURA DO INSPETOR', 14, yPos);
    yPos += 5;
    
    try {
      doc.addImage(data.inspection.signature_data, 'PNG', 14, yPos, 60, 25);
      yPos += 30;
    } catch (e) {
      console.error('Error adding signature image:', e);
    }
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(data.inspector.full_name, 14, yPos);
    yPos += 4;
    if (data.inspection.signed_at) {
      doc.text(`Assinado em: ${format(new Date(data.inspection.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, yPos);
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${i} de ${pageCount} | ID: ${data.inspection.id}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save
  const fileName = `inspecao_${data.equipment.internal_code}_${format(new Date(data.inspection.inspection_date), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
