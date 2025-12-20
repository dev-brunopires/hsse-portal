import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, SBM_BLUE } from './pdfStyles';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import type { Category } from '@/hooks/useCategories';

interface CategoryInspectionResult {
  equipment: EquipmentWithCategory;
  status: 'compliant' | 'attention' | 'non-compliant';
}

interface CategoryInspectionPDFData {
  category: Category;
  ship?: { id: string; name: string; code?: string | null };
  results: CategoryInspectionResult[];
  inspector: {
    name: string;
    position?: string;
    email: string;
  };
  signatureData?: string;
  inspectionDate: string;
}

const statusLabels: Record<string, string> = {
  'compliant': 'Conforme',
  'attention': 'Atenção',
  'non-compliant': 'Não Conforme',
};

export async function exportCategoryInspectionPDF(data: CategoryInspectionPDFData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  // Add header
  let yPosition = await addPDFHeader(
    doc,
    'RELATÓRIO DE INSPEÇÃO POR CATEGORIA',
    format(new Date(data.inspectionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
  );

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('RELATÓRIO DE INSPEÇÃO POR CATEGORIA', pageWidth / 2, yPosition, { align: 'center' });
  
  yPosition += 12;

  // Info Box
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, yPosition, pageWidth - margin * 2, 30, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(73, 80, 87);
  
  const col1X = margin + 5;
  const col2X = pageWidth / 2 + 5;
  
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Categoria:', col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.category.name, col1X + 25, yPosition);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Data:', col2X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(data.inspectionDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }), col2X + 15, yPosition);
  
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Unidade:', col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.ship?.name || 'N/A', col1X + 25, yPosition);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Inspetor:', col2X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.inspector.name, col2X + 25, yPosition);
  
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.results.length} equipamento(s)`, col1X + 20, yPosition);
  
  if (data.inspector.position) {
    doc.setFont('helvetica', 'bold');
    doc.text('Cargo:', col2X, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(data.inspector.position, col2X + 20, yPosition);
  }

  yPosition += 20;

  // Summary Stats
  const compliantCount = data.results.filter(r => r.status === 'compliant').length;
  const attentionCount = data.results.filter(r => r.status === 'attention').length;
  const nonCompliantCount = data.results.filter(r => r.status === 'non-compliant').length;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo:', margin, yPosition);
  
  yPosition += 8;
  
  const summaryBoxWidth = (pageWidth - margin * 2 - 10) / 3;
  
  // Compliant box
  doc.setFillColor(212, 237, 218);
  doc.roundedRect(margin, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(40, 167, 69);
  doc.text(String(compliantCount), margin + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Conforme', margin + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  // Attention box
  doc.setFillColor(255, 243, 205);
  doc.roundedRect(margin + summaryBoxWidth + 5, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 193, 7);
  doc.text(String(attentionCount), margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Atenção', margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  // Non-compliant box
  doc.setFillColor(248, 215, 218);
  doc.roundedRect(margin + (summaryBoxWidth + 5) * 2, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(220, 53, 69);
  doc.text(String(nonCompliantCount), margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Não Conforme', margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  yPosition += 28;

  // Equipment Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('Equipamentos Inspecionados:', margin, yPosition);
  
  yPosition += 5;

  const tableData = data.results.map((result, index) => [
    String(index + 1),
    result.equipment.internal_code,
    result.equipment.name,
    result.equipment.type,
    result.equipment.location,
    statusLabels[result.status] || result.status,
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [['#', 'Código', 'Equipamento', 'Tipo', 'Localização', 'Status']],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [0, 82, 147],
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [33, 37, 41],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 25, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const status = data.results[hookData.row.index]?.status;
        if (status === 'compliant') {
          hookData.cell.styles.textColor = [40, 167, 69];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (status === 'attention') {
          hookData.cell.styles.textColor = [255, 193, 7];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (status === 'non-compliant') {
          hookData.cell.styles.textColor = [220, 53, 69];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // Get final Y position after table
  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Check if we need a new page for signature
  if (yPosition > pageHeight - 80) {
    doc.addPage();
    yPosition = 30;
  }

  // Signature Section
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  
  yPosition += 10;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text('APROVAÇÃO E ASSINATURA', margin, yPosition);
  
  yPosition += 10;

  // Signature box
  const signatureBoxWidth = 80;
  const signatureBoxHeight = 40;
  const signatureBoxX = margin;
  
  doc.setFillColor(252, 252, 252);
  doc.setDrawColor(200, 200, 200);
  doc.roundedRect(signatureBoxX, yPosition, signatureBoxWidth, signatureBoxHeight, 2, 2, 'FD');
  
  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', signatureBoxX + 5, yPosition + 3, signatureBoxWidth - 10, signatureBoxHeight - 10);
    } catch (e) {
      console.error('Error adding signature image:', e);
    }
  }
  
  // Inspector info next to signature
  const infoX = signatureBoxX + signatureBoxWidth + 15;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Inspetor Responsável:', infoX, yPosition + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.inspector.name, infoX, yPosition + 16);
  
  if (data.inspector.position) {
    doc.text(data.inspector.position, infoX, yPosition + 24);
  }
  
  doc.text(`Data: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, infoX, yPosition + 32);

  yPosition += signatureBoxHeight + 10;

  // Line under signature
  doc.setDrawColor(33, 37, 41);
  doc.setLineWidth(0.3);
  doc.line(signatureBoxX, yPosition, signatureBoxX + signatureBoxWidth, yPosition);
  
  doc.setFontSize(8);
  doc.setTextColor(108, 117, 125);
  doc.text('Assinatura Digital', signatureBoxX + signatureBoxWidth / 2, yPosition + 5, { align: 'center' });

  // Footer
  addPDFFooter(
    doc, 
    `SafeShip © ${new Date().getFullYear()}`,
    `Inspeção por Categoria - ${data.category.name}`
  );

  // Save
  const fileName = `inspecao_categoria_${data.category.name.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
}
