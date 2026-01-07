import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, SBM_BLUE, preloadLogo } from './pdfStyles';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import type { Category } from '@/hooks/useCategories';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

interface CategoryInspectionResult {
  equipment: EquipmentWithCategory;
  status: 'compliant' | 'attention' | 'non-compliant';
  lastInspectionDate?: string;
  lastInspectorName?: string;
  expiryStatus?: 'ok' | 'expiry_expired' | 'certificate_expired' | 'both_expired';
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
  branding?: OrganizationBranding;
}

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

const getStatusLabels = (): Record<string, string> => ({
  'compliant': i18n.t('exportCategoryInspection.statusCompliant'),
  'attention': i18n.t('exportCategoryInspection.statusAttention'),
  'non-compliant': i18n.t('exportCategoryInspection.statusNonCompliant'),
});

const getExpiryStatusLabels = (): Record<string, string> => ({
  'ok': '—',
  'expiry_expired': i18n.t('exportCategoryInspection.expiryExpired'),
  'certificate_expired': i18n.t('exportCategoryInspection.certExpired'),
  'both_expired': i18n.t('exportCategoryInspection.bothExpired'),
});

export async function exportCategoryInspectionPDF(data: CategoryInspectionPDFData): Promise<void> {
  const t = i18n.t;
  const dateLocale = getDateLocale();
  const statusLabels = getStatusLabels();
  const expiryStatusLabels = getExpiryStatusLabels();
  
  // Preload logo with branding
  await preloadLogo(data.branding);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  
  // Add header with branding
  let yPosition = await addPDFHeader(
    doc,
    t('exportCategoryInspection.reportTitle'),
    format(new Date(data.inspectionDate), "dd 'de' MMMM 'de' yyyy", { locale: dateLocale }),
    undefined,
    { branding: data.branding }
  );
  
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
  doc.text(`${t('exportCategoryInspection.category')}:`, col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.category.name, col1X + 25, yPosition);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('exportCategoryInspection.date')}:`, col2X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(data.inspectionDate), "dd 'de' MMMM 'de' yyyy", { locale: dateLocale }), col2X + 15, yPosition);
  
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('exportCategoryInspection.unit')}:`, col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.ship?.name || 'N/A', col1X + 25, yPosition);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('exportCategoryInspection.inspector')}:`, col2X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(data.inspector.name, col2X + 25, yPosition);
  
  yPosition += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('exportCategoryInspection.total')}:`, col1X, yPosition);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.results.length} ${t('exportCategoryInspection.equipmentPlural')}`, col1X + 20, yPosition);
  
  if (data.inspector.position) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${t('exportCategoryInspection.position')}:`, col2X, yPosition);
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
  doc.text(`${t('exportCategoryInspection.summary')}:`, margin, yPosition);
  
  yPosition += 8;
  
  const summaryBoxWidth = (pageWidth - margin * 2 - 10) / 3;
  
  // Compliant box
  doc.setFillColor(212, 237, 218);
  doc.roundedRect(margin, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(40, 167, 69);
  doc.text(String(compliantCount), margin + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text(t('exportCategoryInspection.statusCompliant'), margin + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  // Attention box
  doc.setFillColor(255, 243, 205);
  doc.roundedRect(margin + summaryBoxWidth + 5, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 193, 7);
  doc.text(String(attentionCount), margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text(t('exportCategoryInspection.statusAttention'), margin + summaryBoxWidth + 5 + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  // Non-compliant box
  doc.setFillColor(248, 215, 218);
  doc.roundedRect(margin + (summaryBoxWidth + 5) * 2, yPosition, summaryBoxWidth, 18, 2, 2, 'F');
  doc.setFontSize(14);
  doc.setTextColor(220, 53, 69);
  doc.text(String(nonCompliantCount), margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPosition + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text(t('exportCategoryInspection.statusNonCompliant'), margin + (summaryBoxWidth + 5) * 2 + summaryBoxWidth / 2, yPosition + 14, { align: 'center' });
  
  yPosition += 28;

  // Equipment Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text(`${t('exportCategoryInspection.inspectedEquipment')}:`, margin, yPosition);
  
  yPosition += 5;

  const tableData = data.results.map((result, index) => [
    String(index + 1),
    result.equipment.internal_code,
    result.equipment.name,
    result.lastInspectionDate ? format(new Date(result.lastInspectionDate), 'dd/MM/yy', { locale: dateLocale }) : '—',
    result.lastInspectorName || '—',
    statusLabels[result.status] || result.status,
    expiryStatusLabels[result.expiryStatus || 'ok'],
  ]);

  autoTable(doc, {
    startY: yPosition,
    head: [[
      '#', 
      t('exportCategoryInspection.code'), 
      t('exportCategoryInspection.equipment'), 
      t('exportCategoryInspection.lastInspection'), 
      t('exportCategoryInspection.inspector'), 
      t('exportCategoryInspection.status'), 
      t('exportCategoryInspection.expiry')
    ]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [0, 82, 147],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [33, 37, 41],
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30 },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 28, halign: 'center' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        // Status column styling
        if (hookData.column.index === 5) {
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
        // Expiry column styling
        if (hookData.column.index === 6) {
          const expiryStatus = data.results[hookData.row.index]?.expiryStatus;
          if (expiryStatus && expiryStatus !== 'ok') {
            hookData.cell.styles.textColor = [220, 53, 69];
            hookData.cell.styles.fontStyle = 'bold';
          }
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
  doc.text(t('exportCategoryInspection.approvalSignature'), margin, yPosition);
  
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
  doc.text(`${t('exportCategoryInspection.responsibleInspector')}:`, infoX, yPosition + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.text(data.inspector.name, infoX, yPosition + 16);
  
  if (data.inspector.position) {
    doc.text(data.inspector.position, infoX, yPosition + 24);
  }
  
  doc.text(`${t('exportCategoryInspection.date')}: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}`, infoX, yPosition + 32);

  yPosition += signatureBoxHeight + 10;

  // Line under signature
  doc.setDrawColor(33, 37, 41);
  doc.setLineWidth(0.3);
  doc.line(signatureBoxX, yPosition, signatureBoxX + signatureBoxWidth, yPosition);
  
  doc.setFontSize(8);
  doc.setTextColor(108, 117, 125);
  doc.text(t('exportCategoryInspection.digitalSignature'), signatureBoxX + signatureBoxWidth / 2, yPosition + 5, { align: 'center' });

  // Footer
  addPDFFooter(
    doc, 
    data.branding?.name || `SafeShip © ${new Date().getFullYear()}`,
    `${t('exportCategoryInspection.categoryInspection')} - ${data.category.name}`
  );

  // Save
  const fileName = `inspecao_categoria_${data.category.name.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
  doc.save(fileName);
}
