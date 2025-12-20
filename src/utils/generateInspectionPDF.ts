import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface InspectionPDFData {
  inspection: {
    id: string;
    inspection_date: string;
    status: string;
    actions_taken?: string | null;
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
    manufacturing_date?: string;
    acquisition_date?: string;
    expiry_date?: string | null;
    certificate_expiry?: string | null;
    capacity?: string | null;
    status?: string;
  };
  ship?: {
    name: string;
    code?: string | null;
  } | null;
  inspector: {
    full_name: string;
    email: string;
    position?: string | null;
    department?: string | null;
    phone?: string | null;
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
  active: 'Ativo',
  inactive: 'Inativo',
  maintenance: 'Manutenção',
  expired: 'Vencido',
};

const formatDate = (date: string | null | undefined): string => {
  if (!date) return '-';
  try {
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

export function generateInspectionPDF(data: InspectionPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let yPos = 15;

  // Colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // Blue
  const headerBg: [number, number, number] = [241, 245, 249]; // Light gray
  const borderColor: [number, number, number] = [203, 213, 225]; // Gray border

  // === HEADER ===
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE INSPEÇÃO', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emitido em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, 28, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  yPos = 45;

  // === STATUS BADGE ===
  const status = statusLabels[data.inspection.status] || data.inspection.status.toUpperCase();
  const statusColors: Record<string, [number, number, number]> = {
    compliant: [34, 197, 94],
    attention: [234, 179, 8],
    'non-compliant': [239, 68, 68],
  };
  const badgeColor = statusColors[data.inspection.status] || [100, 116, 139];
  
  doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
  const badgeWidth = doc.getTextWidth(status) + 16;
  doc.roundedRect(pageWidth / 2 - badgeWidth / 2, yPos - 6, badgeWidth, 10, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(status, pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  
  yPos += 15;

  // === INFO SUMMARY ROW ===
  const colWidth = (pageWidth - margin * 2) / 3;
  
  // Inspection Date Box
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
  doc.roundedRect(margin, yPos, colWidth - 3, 22, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('DATA DA INSPEÇÃO', margin + 5, yPos + 7);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(data.inspection.inspection_date), margin + 5, yPos + 16);

  // Next Inspection Box
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.roundedRect(margin + colWidth, yPos, colWidth - 3, 22, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('PRÓXIMA INSPEÇÃO', margin + colWidth + 5, yPos + 7);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatDate(data.inspection.next_inspection_date), margin + colWidth + 5, yPos + 16);

  // Ship Box
  doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
  doc.roundedRect(margin + colWidth * 2, yPos, colWidth - 3, 22, 2, 2, 'FD');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('EMBARCAÇÃO', margin + colWidth * 2 + 5, yPos + 7);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const shipText = data.ship ? `${data.ship.name}${data.ship.code ? ` (${data.ship.code})` : ''}` : '-';
  doc.text(shipText.substring(0, 20), margin + colWidth * 2 + 5, yPos + 16);

  yPos += 32;

  // === EQUIPMENT INFORMATION ===
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO EQUIPAMENTO', margin + 4, yPos + 5.5);
  doc.setTextColor(0, 0, 0);
  
  yPos += 8;
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [{ content: 'Nome', styles: { fontStyle: 'bold' } }, data.equipment.name, { content: 'Código Interno', styles: { fontStyle: 'bold' } }, data.equipment.internal_code],
      [{ content: 'Categoria', styles: { fontStyle: 'bold' } }, data.equipment.category_name || '-', { content: 'Tipo', styles: { fontStyle: 'bold' } }, data.equipment.type],
      [{ content: 'Fabricante', styles: { fontStyle: 'bold' } }, data.equipment.manufacturer, { content: 'Modelo', styles: { fontStyle: 'bold' } }, data.equipment.model],
      [{ content: 'Nº de Série', styles: { fontStyle: 'bold' } }, data.equipment.serial_number, { content: 'Capacidade', styles: { fontStyle: 'bold' } }, data.equipment.capacity || '-'],
      [{ content: 'Localização', styles: { fontStyle: 'bold' } }, data.equipment.location, { content: 'Unidade', styles: { fontStyle: 'bold' } }, data.equipment.unit],
      [{ content: 'Data Fabricação', styles: { fontStyle: 'bold' } }, formatDate(data.equipment.manufacturing_date), { content: 'Data Aquisição', styles: { fontStyle: 'bold' } }, formatDate(data.equipment.acquisition_date)],
      [{ content: 'Validade Equip.', styles: { fontStyle: 'bold' } }, formatDate(data.equipment.expiry_date), { content: 'Validade Certif.', styles: { fontStyle: 'bold' } }, formatDate(data.equipment.certificate_expiry)],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3, lineColor: borderColor, lineWidth: 0.1 },
    columnStyles: { 
      0: { cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: 55 },
    },
    tableLineColor: borderColor,
    tableLineWidth: 0.5,
  });

  // === INSPECTOR INFORMATION ===
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO INSPETOR', margin + 4, yPos + 5.5);
  doc.setTextColor(0, 0, 0);
  
  yPos += 8;
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        { content: 'Nome', styles: { fontStyle: 'bold' } }, data.inspector.full_name,
        { content: 'Email', styles: { fontStyle: 'bold' } }, data.inspector.email
      ],
      [
        { content: 'Cargo', styles: { fontStyle: 'bold' } }, data.inspector.position || '-',
        { content: 'Departamento', styles: { fontStyle: 'bold' } }, data.inspector.department || '-'
      ],
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3, lineColor: borderColor, lineWidth: 0.1 },
    columnStyles: { 
      0: { cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: 55 },
    },
    tableLineColor: borderColor,
    tableLineWidth: 0.5,
  });

  // === CHECKLIST ===
  yPos = (doc as any).lastAutoTable.finalY + 8;
  
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CHECKLIST DE VERIFICAÇÃO', margin + 4, yPos + 5.5);
  doc.setTextColor(0, 0, 0);
  
  yPos += 8;
  
  if (data.checklistItems.length > 0) {
    const checklistBody = data.checklistItems.map((item, index) => {
      const itemStatus = statusLabels[item.status] || item.status;
      const statusColor: [number, number, number] = item.status === 'ok' 
        ? [34, 197, 94] 
        : item.status === 'fail' 
          ? [239, 68, 68] 
          : [100, 116, 139];
      return [
        (index + 1).toString(),
        item.description,
        { 
          content: itemStatus, 
          styles: { 
            textColor: statusColor,
            fontStyle: 'bold' as const
          } 
        },
        item.notes || '-',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Item Verificado', 'Status', 'Observações']],
      body: checklistBody,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 65 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      headStyles: { fillColor: headerBg, textColor: [30, 41, 59], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('Nenhum item de checklist registrado.', margin, yPos + 8);
    yPos += 15;
  }

  // === OBSERVATIONS, RECOMMENDATIONS, ACTIONS ===
  yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos;
  
  const textSections = [
    { title: 'AÇÕES TOMADAS', content: data.inspection.actions_taken },
    { title: 'OBSERVAÇÕES', content: data.inspection.observations },
    { title: 'RECOMENDAÇÕES', content: data.inspection.recommendations },
  ].filter(s => s.content);

  for (const section of textSections) {
    // Check for new page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(headerBg[0], headerBg[1], headerBg[2]);
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.roundedRect(margin, yPos, pageWidth - margin * 2, 8, 1, 1, 'FD');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(section.title, margin + 4, yPos + 5.5);
    
    yPos += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(section.content!, pageWidth - margin * 2 - 8);
    doc.text(lines, margin + 4, yPos + 4);
    yPos += lines.length * 4.5 + 8;
  }

  // === SIGNATURE ===
  if (data.inspection.signature_data) {
    if (yPos > pageHeight - 70) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ASSINATURA DIGITAL', margin + 4, yPos + 5.5);
    doc.setTextColor(0, 0, 0);
    
    yPos += 12;
    
    // Signature box
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, yPos, 80, 35, 2, 2, 'FD');
    
    try {
      doc.addImage(data.inspection.signature_data, 'PNG', margin + 5, yPos + 2, 70, 25);
    } catch (e) {
      console.error('Error adding signature image:', e);
    }
    
    // Signature details on the right
    const sigX = margin + 90;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(data.inspector.full_name, sigX, yPos + 10);
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    if (data.inspector.position) {
      doc.text(data.inspector.position, sigX, yPos + 16);
    }
    if (data.inspection.signed_at) {
      doc.text(`Assinado em: ${format(new Date(data.inspection.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, sigX, yPos + 22);
    }
    doc.setTextColor(0, 0, 0);
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer line
    doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
    
    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${data.inspection.id.substring(0, 8)}`, margin, pageHeight - 8);
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text(`${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  // Save
  const fileName = `inspecao_${data.equipment.internal_code}_${format(new Date(data.inspection.inspection_date), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
