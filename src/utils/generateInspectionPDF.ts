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

// SBM Brand Colors
const SBM_ORANGE: [number, number, number] = [243, 111, 39]; // #F36F27
const SBM_BLUE: [number, number, number] = [22, 85, 154]; // #16559A
const DARK_GRAY: [number, number, number] = [51, 51, 51];
const LIGHT_GRAY: [number, number, number] = [245, 247, 250];
const MEDIUM_GRAY: [number, number, number] = [156, 163, 175];
const BORDER_GRAY: [number, number, number] = [229, 231, 235];

export function generateInspectionPDF(data: InspectionPDFData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 0;

  // === HEADER WITH SBM BRANDING ===
  // Orange accent bar at top
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(0, 0, pageWidth, 5, 'F');
  
  // Blue header section
  doc.setFillColor(...SBM_BLUE);
  doc.rect(0, 5, pageWidth, 32, 'F');
  
  // Company name (since we can't embed image easily in jsPDF without base64)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('SBM', margin, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFSHORE', margin, 30);
  
  // Report title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE INSPEÇÃO', pageWidth - margin, 20, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Documento: INS-${data.inspection.id.substring(0, 8).toUpperCase()}`, pageWidth - margin, 28, { align: 'right' });
  doc.text(`Emitido: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin, 34, { align: 'right' });
  
  yPos = 47;

  // === UNIT AND STATUS ROW ===
  // Unit/Ship information box
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(margin, yPos, (pageWidth - margin * 2 - 10) / 2, 20, 2, 2, 'F');
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...MEDIUM_GRAY);
  doc.text('UNIDADE / EMBARCAÇÃO', margin + 5, yPos + 6);
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  const shipText = data.ship ? `${data.ship.name}${data.ship.code ? ` (${data.ship.code})` : ''}` : 'Não especificada';
  doc.text(shipText, margin + 5, yPos + 14);

  // Status badge
  const status = statusLabels[data.inspection.status] || data.inspection.status.toUpperCase();
  const statusColors: Record<string, [number, number, number]> = {
    compliant: [16, 185, 129],
    attention: [245, 158, 11],
    'non-compliant': [239, 68, 68],
  };
  const badgeColor = statusColors[data.inspection.status] || SBM_BLUE;
  
  const statusBoxX = margin + (pageWidth - margin * 2 - 10) / 2 + 10;
  const statusBoxWidth = (pageWidth - margin * 2 - 10) / 2;
  
  doc.setFillColor(...badgeColor);
  doc.roundedRect(statusBoxX, yPos, statusBoxWidth, 20, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS DA INSPEÇÃO', statusBoxX + 5, yPos + 6);
  
  doc.setFontSize(14);
  doc.text(status, statusBoxX + 5, yPos + 15);
  
  yPos += 28;

  // === KEY DATES ROW ===
  const dateBoxWidth = (pageWidth - margin * 2 - 10) / 3;
  
  const dateBoxes = [
    { label: 'DATA DA INSPEÇÃO', value: formatDate(data.inspection.inspection_date) },
    { label: 'PRÓXIMA INSPEÇÃO', value: formatDate(data.inspection.next_inspection_date) },
    { label: 'VALIDADE CERTIFICADO', value: formatDate(data.equipment.certificate_expiry) },
  ];
  
  dateBoxes.forEach((box, index) => {
    const xPos = margin + (dateBoxWidth + 5) * index;
    
    doc.setDrawColor(...BORDER_GRAY);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(xPos, yPos, dateBoxWidth, 18, 2, 2, 'FD');
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(box.label, xPos + 4, yPos + 6);
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GRAY);
    doc.text(box.value, xPos + 4, yPos + 14);
  });
  
  yPos += 25;

  // === EQUIPMENT SECTION ===
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(margin, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin + 4, yPos, pageWidth - margin * 2 - 4, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text('DADOS DO EQUIPAMENTO', margin + 10, yPos + 5.5);
  
  yPos += 8;
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        { content: 'Nome:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        { content: data.equipment.name, styles: { fontStyle: 'bold', textColor: DARK_GRAY } },
        { content: 'Código:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        { content: data.equipment.internal_code, styles: { fontStyle: 'bold', textColor: SBM_BLUE } }
      ],
      [
        { content: 'Categoria:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.category_name || '-',
        { content: 'Tipo:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.type
      ],
      [
        { content: 'Fabricante:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.manufacturer,
        { content: 'Modelo:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.model
      ],
      [
        { content: 'Nº Série:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.serial_number,
        { content: 'Capacidade:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.capacity || '-'
      ],
      [
        { content: 'Localização:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.location,
        { content: 'Unidade:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.equipment.unit
      ],
    ],
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: DARK_GRAY
    },
    columnStyles: { 
      0: { cellWidth: 28 },
      1: { cellWidth: 62 },
      2: { cellWidth: 28 },
      3: { cellWidth: 62 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === INSPECTOR SECTION ===
  doc.setFillColor(...SBM_BLUE);
  doc.rect(margin, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin + 4, yPos, pageWidth - margin * 2 - 4, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text('RESPONSÁVEL PELA INSPEÇÃO', margin + 10, yPos + 5.5);
  
  yPos += 8;
  
  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      [
        { content: 'Inspetor:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        { content: data.inspector.full_name, styles: { fontStyle: 'bold', textColor: DARK_GRAY } },
        { content: 'Email:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.inspector.email
      ],
      [
        { content: 'Cargo:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.inspector.position || '-',
        { content: 'Departamento:', styles: { fontStyle: 'bold', textColor: MEDIUM_GRAY } }, 
        data.inspector.department || '-'
      ],
    ],
    theme: 'plain',
    styles: { 
      fontSize: 9, 
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      textColor: DARK_GRAY
    },
    columnStyles: { 
      0: { cellWidth: 28 },
      1: { cellWidth: 62 },
      2: { cellWidth: 28 },
      3: { cellWidth: 62 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // === CHECKLIST SECTION ===
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(margin, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin + 4, yPos, pageWidth - margin * 2 - 4, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text('CHECKLIST DE VERIFICAÇÃO', margin + 10, yPos + 5.5);
  
  yPos += 8;
  
  if (data.checklistItems.length > 0) {
    const checklistBody = data.checklistItems.map((item, index) => {
      const itemStatus = statusLabels[item.status] || item.status;
      const statusColor: [number, number, number] = item.status === 'ok' 
        ? [16, 185, 129]
        : item.status === 'fail' 
          ? [239, 68, 68] 
          : MEDIUM_GRAY;
      return [
        { content: (index + 1).toString(), styles: { halign: 'center' as const } },
        item.description,
        { 
          content: itemStatus, 
          styles: { 
            textColor: statusColor,
            fontStyle: 'bold' as const,
            halign: 'center' as const
          } 
        },
        item.notes || '-',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Item de Verificação', 'Resultado', 'Observações']],
      body: checklistBody,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 'auto' },
      },
      headStyles: { 
        fillColor: SBM_BLUE, 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 8;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text('Nenhum item de checklist registrado para esta inspeção.', margin, yPos + 8);
    yPos += 15;
  }

  // === OBSERVATIONS, RECOMMENDATIONS, ACTIONS ===
  const textSections = [
    { title: 'AÇÕES TOMADAS', content: data.inspection.actions_taken, color: SBM_BLUE },
    { title: 'OBSERVAÇÕES', content: data.inspection.observations, color: SBM_ORANGE },
    { title: 'RECOMENDAÇÕES', content: data.inspection.recommendations, color: SBM_BLUE },
  ].filter(s => s.content);

  for (const section of textSections) {
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(...section.color);
    doc.rect(margin, yPos, 4, 8, 'F');
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(margin + 4, yPos, pageWidth - margin * 2 - 4, 8, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GRAY);
    doc.text(section.title, margin + 10, yPos + 5.5);
    
    yPos += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK_GRAY);
    const lines = doc.splitTextToSize(section.content!, pageWidth - margin * 2 - 8);
    doc.text(lines, margin + 4, yPos);
    yPos += lines.length * 4.5 + 8;
  }

  // === SIGNATURE SECTION ===
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFillColor(...SBM_BLUE);
  doc.rect(margin, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(margin + 4, yPos, pageWidth - margin * 2 - 4, 8, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text('ASSINATURA E APROVAÇÃO', margin + 10, yPos + 5.5);
  
  yPos += 15;
  
  // Signature box
  const sigBoxWidth = 80;
  const sigBoxHeight = 35;
  
  doc.setDrawColor(...BORDER_GRAY);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  
  if (data.inspection.signature_data) {
    try {
      doc.addImage(data.inspection.signature_data, 'PNG', margin + 5, yPos + 2, 70, 25);
    } catch (e) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...MEDIUM_GRAY);
      doc.text('Assinatura digital registrada', margin + 10, yPos + 18);
    }
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text('Aguardando assinatura', margin + 15, yPos + 18);
  }
  
  // Signature line
  doc.setDrawColor(...DARK_GRAY);
  doc.line(margin, yPos + sigBoxHeight + 2, margin + sigBoxWidth, yPos + sigBoxHeight + 2);
  
  // Inspector details next to signature
  const detailsX = margin + sigBoxWidth + 15;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text(data.inspector.full_name, detailsX, yPos + 10);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  
  if (data.inspector.position) {
    doc.text(data.inspector.position, detailsX, yPos + 17);
  }
  if (data.inspector.department) {
    doc.text(data.inspector.department, detailsX, yPos + 24);
  }
  if (data.inspection.signed_at) {
    doc.setTextColor(...SBM_BLUE);
    doc.text(`Assinado em: ${format(new Date(data.inspection.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, detailsX, yPos + 31);
  }

  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer orange accent
    doc.setFillColor(...SBM_ORANGE);
    doc.rect(0, pageHeight - 12, pageWidth, 2, 'F');
    
    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text('SBM Offshore - Sistema de Gestão de Equipamentos de Segurança', margin, pageHeight - 5);
    doc.text(`Documento: INS-${data.inspection.id.substring(0, 8).toUpperCase()}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }

  // Save
  const fileName = `SBM_Inspecao_${data.equipment.internal_code}_${format(new Date(data.inspection.inspection_date), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
  
  return fileName;
}
