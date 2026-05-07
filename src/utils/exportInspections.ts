import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { getLocalToday, parseLocalDate } from '@/utils/dateFormat';
import { ptBR, enUS } from 'date-fns/locale';
import type { InspectionWithDetails, InspectionPhoto } from '@/hooks/useInspections';
import { supabase } from '@/integrations/supabase/client';
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
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import { formatInspectionId } from './formatId';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

async function loadInspectionPhotoAsBase64(filePath: string): Promise<string | null> {
  try {
    // Use download() instead of signed URL + fetch to avoid CORS issues
    const { data, error } = await supabase.storage
      .from('inspection-photos')
      .download(filePath);
    
    if (error || !data) {
      console.warn('Failed to download inspection photo:', filePath, error?.message);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
  } catch (e) {
    console.warn('Error loading inspection photo for PDF:', filePath, e);
    return null;
  }
}

const getStatusLabels = (): Record<string, string> => ({
  approved: i18n.t('exportInspections.statusApproved'),
  pending: i18n.t('exportInspections.statusPending'),
  rejected: i18n.t('exportInspections.statusRejected'),
  conditional: i18n.t('exportInspections.statusConditional'),
  compliant: i18n.t('exportInspections.statusCompliant'),
  attention: i18n.t('exportInspections.statusAttention'),
  'non-compliant': i18n.t('exportInspections.statusNonCompliant'),
});

const getAlertLabels = () => ({
  certificateExpired: i18n.t('alerts.reportCertExpired'),
  certificateExpiring: i18n.t('alerts.reportCertExpiring'),
  equipmentExpired: i18n.t('alerts.reportEquipExpired'),
  inspectionOverdue: i18n.t('alerts.reportInspOverdue'),
  inspectionDueSoon: i18n.t('alerts.reportInspDueSoon'),
});

// Build alert indicators for an inspection's equipment
const getEquipmentAlertIndicators = (
  item: InspectionWithDetails,
  allEquipment?: { id: string; certificate_expiry?: string | null; expiry_date?: string | null; next_inspection?: string | null }[]
): string[] => {
  const alertIndicators: string[] = [];
  const today = getLocalToday();
  const alertLabels = getAlertLabels();
  
  // If we have full equipment data, use it
  const fullEquipment = allEquipment?.find(e => e.id === item.equipment_id);
  
  if (fullEquipment) {
    if (fullEquipment.certificate_expiry && fullEquipment.certificate_expiry < today) {
      alertIndicators.push(alertLabels.certificateExpired);
    }
    if (fullEquipment.expiry_date && fullEquipment.expiry_date < today) {
      alertIndicators.push(alertLabels.equipmentExpired);
    }
    if (fullEquipment.next_inspection && fullEquipment.next_inspection < today) {
      alertIndicators.push(alertLabels.inspectionOverdue);
    }
  }
  
  return alertIndicators;
};

export function exportInspectionsToExcel(
  inspections: InspectionWithDetails[], 
  filename = 'inspecoes',
  allEquipment?: { id: string; certificate_expiry?: string | null; expiry_date?: string | null; next_inspection?: string | null }[]
) {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  const data = inspections.map(item => {
    const alertIndicators = getEquipmentAlertIndicators(item, allEquipment);
    
    return {
      [t('exportInspections.inspectionDate')]: format(parseLocalDate(item.inspection_date) || new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
      [t('exportInspections.equipment')]: item.equipment?.name || '—',
      [t('exportInspections.code')]: item.equipment?.internal_code || '—',
      [t('reports.serialNumber')]: (item.equipment as any)?.serial_number || '—',
      [t('reports.category')]: (item.equipment as any)?.categories?.name || '—',
      [t('common.location')]: (item.equipment as any)?.location || '—',
      [t('exportInspections.inspector')]: item.profiles?.full_name || '—',
      [t('exportInspections.inspectorEmail')]: item.profiles?.email || '—',
      [t('exportInspections.status')]: statusLabels[item.status] || item.status,
      [t('reports.equipmentAlerts')]: alertIndicators.length > 0 ? alertIndicators.join(' | ') : '—',
      [t('exportInspections.observations')]: item.observations || '—',
      [t('exportInspections.recommendations')]: item.recommendations || '—',
      [t('exportInspections.nextInspection')]: item.next_inspection_date 
        ? format(parseLocalDate(item.next_inspection_date) || new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: dateLocale }) 
        : '—',
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('exportInspections.sheetName'));
  
  // Auto-size columns
  const maxWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length).slice(0, 50))
  }));
  ws['!cols'] = maxWidths;

  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function exportInspectionsToPDF(
  inspections: InspectionWithDetails[], 
  filename = 'relatorio_inspecoes',
  branding?: OrganizationBranding,
  options?: { preview?: boolean },
  allEquipment?: { id: string; certificate_expiry?: string | null; expiry_date?: string | null; next_inspection?: string | null }[]
) {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  // Preload logo with branding
  await preloadLogo(branding);
  
  const doc = new jsPDF('landscape');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale });
  
  // Add standardized header with logo and branding
  let yPos = await addPDFHeader(
    doc,
    t('exportInspections.reportTitle'),
    `${t('exportInspections.generatedAt')}: ${generatedDate}`,
    [`${t('exportInspections.total')}: ${inspections.length} ${t('exportInspections.inspectionsPlural')}`],
    { branding }
  );

  // Summary
  const approved = inspections.filter(i => i.status === 'approved' || i.status === 'compliant').length;
  const rejected = inspections.filter(i => i.status === 'rejected' || i.status === 'non-compliant').length;
  const pending = inspections.filter(i => i.status === 'pending' || i.status === 'attention').length;
  
  // Add summary section
  yPos = addSectionHeader(doc, yPos, t('exportInspections.summary'), SBM_BLUE);
  yPos += 2;
  
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${t('exportInspections.approved')}: ${approved} | ${t('exportInspections.rejected')}: ${rejected} | ${t('exportInspections.pending')}: ${pending}`, 14, yPos + 4);
  yPos += 12;

  const tableData = inspections.map(item => {
    const alertIndicators = getEquipmentAlertIndicators(item, allEquipment);
    const alertsText = alertIndicators.length > 0 ? alertIndicators.join(' ') : '—';
    const fullEquip = allEquipment?.find(e => e.id === item.equipment_id) as any;
    
    return [
      format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
      item.equipment?.name || '—',
      item.equipment?.internal_code || '—',
      (item.equipment as any)?.serial_number || fullEquip?.serial_number || '—',
      (item.equipment as any)?.categories?.name || fullEquip?.categories?.name || '—',
      (item.equipment as any)?.location || fullEquip?.location || '—',
      item.profiles?.full_name || '—',
      statusLabels[item.status] || item.status,
      item.next_inspection_date 
        ? format(new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: dateLocale }) 
        : '—',
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('exportInspections.date'),
      t('exportInspections.equipment'),
      t('exportInspections.code'),
      t('reports.serialNumber'),
      t('reports.category'),
      t('common.location'),
      t('exportInspections.inspector'),
      t('exportInspections.status'),
      t('exportInspections.next')
    ]],
    body: tableData,
    styles: { 
      fontSize: 8, 
      cellPadding: 3,
      minCellHeight: 10,
    },
    headStyles: { 
      fillColor: SBM_BLUE,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 3,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 'auto' }, // Equipment
      2: { cellWidth: 20 }, // Code
      3: { cellWidth: 24 }, // Serial
      4: { cellWidth: 24 }, // Category
      5: { cellWidth: 26 }, // Location
      6: { cellWidth: 28 }, // Inspector
      7: { cellWidth: 22 }, // Status
      8: { cellWidth: 22 }, // Next
    }
  });

  // Add standardized footer with organization name
  const companyName = branding?.name || 'SafeShip';
  addPDFFooter(
    doc,
    t('exportInspections.footerCompany', { companyName }),
    `${t('exportInspections.reportTitle')} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  const pdfFileName = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(pdfFileName);
  }
}

export async function exportSingleInspectionPDF(
  inspection: InspectionWithDetails, 
  checklistItems: { description: string; status: string; notes: string | null }[] = [],
  photos: InspectionPhoto[] = [],
  branding?: OrganizationBranding,
  options?: { preview?: boolean }
) {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  const companyName = branding?.name || 'SafeShip';
  
  // Preload logo with branding
  await preloadLogo(branding);
  
  const doc = new jsPDF();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    t('exportInspections.singleReportTitle'),
    `${t('exportInspections.document')}: ${formatInspectionId(inspection.id)}`,
    [`${t('exportInspections.issued')}: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}`],
    { branding }
  );
  
  // Inspection info section
  yPos = addSectionHeader(doc, yPos, t('exportInspections.inspectionData'), SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${t('exportInspections.date')}: ${format(parseLocalDate(inspection.inspection_date) || new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: dateLocale })}`, 14, yPos);
  doc.text(`${t('exportInspections.status')}: ${statusLabels[inspection.status] || inspection.status}`, 100, yPos);
  yPos += 6;
  doc.text(`${t('exportInspections.inspector')}: ${inspection.profiles?.full_name || '—'}`, 14, yPos);
  doc.text(`${t('exportInspections.email')}: ${inspection.profiles?.email || '—'}`, 100, yPos);
  yPos += 10;
  
  // Equipment info section - expanded with more details
  yPos = addSectionHeader(doc, yPos, t('exportInspections.equipmentSection'), SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${t('exportInspections.name')}: ${inspection.equipment?.name || '—'}`, 14, yPos);
  doc.text(`${t('exportInspections.code')}: ${inspection.equipment?.internal_code || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`${t('exportInspections.serialNumber')}: ${inspection.equipment?.serial_number || '—'}`, 14, yPos);
  doc.text(`${t('exportInspections.type')}: ${inspection.equipment?.type || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`${t('exportInspections.manufacturer')}: ${inspection.equipment?.manufacturer || '—'}`, 14, yPos);
  doc.text(`${t('exportInspections.model')}: ${inspection.equipment?.model || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`${t('exportInspections.location')}: ${inspection.equipment?.location || '—'}`, 14, yPos);
  doc.text(`${t('exportInspections.capacity')}: ${inspection.equipment?.capacity || '—'}`, 100, yPos);
  yPos += 10;
  
  // Checklist section
  if (checklistItems.length > 0) {
    yPos = addSectionHeader(doc, yPos, t('exportInspections.checklist'), SBM_BLUE);
    
    const checklistStatusLabels: Record<string, string> = {
      ok: t('exportInspections.checklistOk'),
      fail: t('exportInspections.checklistFail'),
      pending: t('exportInspections.checklistPending'),
    };
    
    autoTable(doc, {
      startY: yPos + 2,
      head: [[t('exportInspections.item'), t('exportInspections.status'), t('exportInspections.observations')]],
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
    yPos = addSectionHeader(doc, yPos, t('exportInspections.observationsSection'), SBM_BLUE);
    yPos += 4;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(inspection.observations, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 6;
  }
  
  // Recommendations section
  if (inspection.recommendations) {
    yPos = addSectionHeader(doc, yPos, t('exportInspections.recommendationsSection'), SBM_BLUE);
    yPos += 4;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(inspection.recommendations, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 6;
  }

  // Photos section - LARGER photos for better visibility
  if (photos && photos.length > 0) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (yPos > pageHeight - 100) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader(doc, yPos, t('exportInspections.photos'), SBM_BLUE);
    yPos += 4;

    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(`${photos.length} ${t('exportInspections.photosAttached')}`, 14, yPos);
    yPos += 8;

    // Larger photo dimensions for better visibility
    const photoWidth = 85;
    const photoHeight = 65;
    const photosPerRow = 2;
    let photoX = 14;
    let photoCount = 0;

    for (const photo of photos) {
      // Check if we need a new page
      if (yPos > pageHeight - 80) {
        doc.addPage();
        yPos = 20;
        photoX = 14;
      }

      try {
        const base64 = await loadInspectionPhotoAsBase64(photo.file_path);
        if (base64) {
          doc.addImage(base64, 'JPEG', photoX, yPos, photoWidth, photoHeight);
        } else {
          // Placeholder for failed image
          doc.setDrawColor(...MEDIUM_GRAY);
          doc.setFillColor(248, 250, 252);
          doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(...MEDIUM_GRAY);
          doc.text(t('exportInspections.imageNotAvailable'), photoX + 20, yPos + 32);
        }
      } catch {
        doc.setDrawColor(...MEDIUM_GRAY);
        doc.setFillColor(248, 250, 252);
        doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(...MEDIUM_GRAY);
        doc.text(t('exportInspections.imageNotAvailable'), photoX + 20, yPos + 32);
      }

      photoCount++;
      if (photoCount % photosPerRow === 0) {
        photoX = 14;
        yPos += photoHeight + 8;
      } else {
        photoX += photoWidth + 12;
      }
    }

    // Move to next row if photos don't fill the row
    if (photoCount % photosPerRow !== 0) {
      yPos += photoHeight + 8;
    }
  }
  
  // Signature section
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos = addSectionHeader(doc, yPos, t('exportInspections.signature'), SBM_BLUE);
  yPos += 4;
  
  // Compact signature box (1/3 of page)
  const sigBoxWidth = 70;
  const sigBoxHeight = 25;
  
  doc.setDrawColor(...MEDIUM_GRAY);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  
  if (inspection.signature_data) {
    try {
      doc.addImage(inspection.signature_data, 'PNG', 17, yPos + 2, sigBoxWidth - 6, sigBoxHeight - 5);
    } catch (e) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...MEDIUM_GRAY);
      doc.text(t('exportInspections.digitalSignatureRegistered'), 22, yPos + 14);
    }
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('exportInspections.awaitingSignature'), 26, yPos + 14);
  }
  
  // Signature line
  doc.setDrawColor(...DARK_GRAY);
  doc.line(14, yPos + sigBoxHeight + 2, 14 + sigBoxWidth, yPos + sigBoxHeight + 2);
  
  // Inspector info beside signature
  const detailsX = 14 + sigBoxWidth + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK_GRAY);
  doc.text(inspection.profiles?.full_name || '—', detailsX, yPos + 10);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MEDIUM_GRAY);
  if (inspection.profiles?.position) {
    doc.text(inspection.profiles.position, detailsX, yPos + 16);
  }
  if (inspection.signed_at) {
    doc.setTextColor(...SBM_BLUE);
    doc.text(`${t('exportInspections.signedAt')}: ${format(new Date(inspection.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}`, detailsX, yPos + 22);
  }

  // Add standardized footer with organization name
  addPDFFooter(
    doc,
    t('exportInspections.footerCompany', { companyName }),
    `${t('exportInspections.singleReportTitle')} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  const pdfFileName = `inspecao_${formatInspectionId(inspection.id).replace('-', '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(pdfFileName);
  }
}
