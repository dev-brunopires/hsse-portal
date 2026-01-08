import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
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

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

async function loadInspectionPhotoAsBase64(filePath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from('inspection-photos')
      .createSignedUrl(filePath, 60);
    
    if (!data?.signedUrl) return null;

    const response = await fetch(data.signedUrl);
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
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

export function exportInspectionsToExcel(inspections: InspectionWithDetails[], filename = 'inspecoes') {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  const data = inspections.map(item => ({
    [t('exportInspections.inspectionDate')]: format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
    [t('exportInspections.equipment')]: item.equipment?.name || '—',
    [t('exportInspections.code')]: item.equipment?.internal_code || '—',
    [t('exportInspections.inspector')]: item.profiles?.full_name || '—',
    [t('exportInspections.inspectorEmail')]: item.profiles?.email || '—',
    [t('exportInspections.status')]: statusLabels[item.status] || item.status,
    [t('exportInspections.observations')]: item.observations || '—',
    [t('exportInspections.recommendations')]: item.recommendations || '—',
    [t('exportInspections.nextInspection')]: item.next_inspection_date 
      ? format(new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: dateLocale }) 
      : '—',
  }));

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
  options?: { preview?: boolean }
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

  const tableData = inspections.map(item => [
    format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: dateLocale }),
    item.equipment?.name || '—',
    item.equipment?.internal_code || '—',
    item.profiles?.full_name || '—',
    statusLabels[item.status] || item.status,
    item.observations?.substring(0, 50) || '—',
    item.next_inspection_date 
      ? format(new Date(item.next_inspection_date), 'dd/MM/yyyy', { locale: dateLocale }) 
      : '—',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('exportInspections.date'),
      t('exportInspections.equipment'),
      t('exportInspections.code'),
      t('exportInspections.inspector'),
      t('exportInspections.status'),
      t('exportInspections.observations'),
      t('exportInspections.next')
    ]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: SBM_BLUE },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add standardized footer
  addPDFFooter(
    doc,
    t('exportInspections.footerCompany'),
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
  options?: { preview?: boolean }
) {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    t('exportInspections.singleReportTitle'),
    `${t('exportInspections.document')}: INS-${inspection.id.substring(0, 8).toUpperCase()}`,
    [`${t('exportInspections.issued')}: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: dateLocale })}`]
  );
  
  // Inspection info section
  yPos = addSectionHeader(doc, yPos, t('exportInspections.inspectionData'), SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${t('exportInspections.date')}: ${format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: dateLocale })}`, 14, yPos);
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

  // Photos section
  if (photos && photos.length > 0) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (yPos > pageHeight - 80) {
      doc.addPage();
      yPos = 20;
    }

    yPos = addSectionHeader(doc, yPos, t('exportInspections.photos'), SBM_BLUE);
    yPos += 4;

    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(`${photos.length} ${t('exportInspections.photosAttached')}`, 14, yPos);
    yPos += 8;

    const photoWidth = 55;
    const photoHeight = 40;
    const photosPerRow = 3;
    let photoX = 14;
    let photoCount = 0;

    for (const photo of photos) {
      // Check if we need a new page
      if (yPos > pageHeight - 50) {
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
          doc.text(t('exportInspections.imageNotAvailable'), photoX + 5, yPos + 22);
        }
      } catch {
        doc.setDrawColor(...MEDIUM_GRAY);
        doc.setFillColor(248, 250, 252);
        doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(...MEDIUM_GRAY);
        doc.text(t('exportInspections.imageNotAvailable'), photoX + 5, yPos + 22);
      }

      photoCount++;
      if (photoCount % photosPerRow === 0) {
        photoX = 14;
        yPos += photoHeight + 5;
      } else {
        photoX += photoWidth + 5;
      }
    }

    // Move to next row if photos don't fill the row
    if (photoCount % photosPerRow !== 0) {
      yPos += photoHeight + 5;
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
  
  const sigBoxWidth = 80;
  const sigBoxHeight = 30;
  
  doc.setDrawColor(...MEDIUM_GRAY);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, yPos, sigBoxWidth, sigBoxHeight, 2, 2, 'FD');
  
  if (inspection.signature_data) {
    try {
      doc.addImage(inspection.signature_data, 'PNG', 18, yPos + 2, 72, 26);
    } catch (e) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...MEDIUM_GRAY);
      doc.text(t('exportInspections.digitalSignatureRegistered'), 24, yPos + 16);
    }
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('exportInspections.awaitingSignature'), 28, yPos + 16);
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

  // Add standardized footer
  addPDFFooter(
    doc,
    t('exportInspections.footerCompany'),
    `${t('exportInspections.singleReportTitle')} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  const pdfFileName = `inspecao_${inspection.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(pdfFileName);
  }
}
