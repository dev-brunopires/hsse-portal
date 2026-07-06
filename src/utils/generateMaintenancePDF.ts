import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, addSectionHeader, SBM_BLUE, DARK_GRAY, DANGER_RED, MEDIUM_GRAY, preloadLogo } from './pdfStyles';
import type { MaintenanceRequestWithDetails, MaintenancePhoto } from '@/hooks/useMaintenanceRequests';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import { formatMaintenanceId } from './formatId';

interface MaintenanceHistory {
  id: string;
  type: string;
  status: string;
  title: string;
  completed_at: string | null;
  work_performed: string | null;
}

interface MaintenanceDetailData extends MaintenanceRequestWithDetails {
  history?: MaintenanceHistory[];
  branding?: OrganizationBranding;
}

function getDateLocale() {
  return i18n.language === 'pt-BR' ? ptBR : enUS;
}

function getLabels() {
  const t = i18n.t.bind(i18n);
  
  return {
    status: {
      pending: t('generateMaintenancePDF.statusPending'),
      approved: t('generateMaintenancePDF.statusApproved'),
      in_progress: t('generateMaintenancePDF.statusInProgress'),
      completed: t('generateMaintenancePDF.statusCompleted'),
      rejected: t('generateMaintenancePDF.statusRejected'),
    } as Record<string, string>,
    type: {
      preventive: t('generateMaintenancePDF.typePreventive'),
      corrective: t('generateMaintenancePDF.typeCorrective'),
    } as Record<string, string>,
    priority: {
      low: t('generateMaintenancePDF.priorityLow'),
      medium: t('generateMaintenancePDF.priorityMedium'),
      high: t('generateMaintenancePDF.priorityHigh'),
      critical: t('generateMaintenancePDF.priorityCritical'),
    } as Record<string, string>,
  };
}

function formatDateBR(date: string | null | undefined): string {
  if (!date) return 'N/A';
  return format(new Date(date), 'dd/MM/yyyy', { locale: getDateLocale() });
}

function addInfoRow(doc: jsPDF, label: string, value: string, yPos: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${label}:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(value || 'N/A', 60, yPos);
  return yPos + 6;
}

async function loadPhotoAsBase64(filePath: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage
      .from('maintenance-photos')
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

export async function generateMaintenancePDF(data: MaintenanceDetailData, options?: { preview?: boolean }): Promise<void> {
  // Preload logo with branding
  await preloadLogo(data.branding);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const t = i18n.t.bind(i18n);
  const labels = getLabels();
  
  // Add header with branding
  await addPDFHeader(doc, t('generateMaintenancePDF.reportTitle'), formatDateBR(data.requested_at), undefined, { branding: data.branding });
  
  let yPos = 50;
  
  // Request info section
  yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.requestInfo'));
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  
  const requestInfo = [
    [t('generateMaintenancePDF.requestNumber'), formatMaintenanceId(data.id)],
    [t('generateMaintenancePDF.type'), labels.type[data.type] || data.type],
    [t('generateMaintenancePDF.priority'), labels.priority[data.priority] || data.priority],
    [t('generateMaintenancePDF.status'), labels.status[data.status] || data.status],
    [t('generateMaintenancePDF.requestDate'), formatDateBR(data.requested_at)],
    [t('generateMaintenancePDF.requester'), data.requester?.full_name || 'N/A'],
  ];

  if (data.scheduled_date) {
    requestInfo.push([t('generateMaintenancePDF.scheduledDate'), formatDateBR(data.scheduled_date)]);
  }

  if (data.approved_at) {
    requestInfo.push([t('generateMaintenancePDF.approvalDate'), formatDateBR(data.approved_at)]);
    requestInfo.push([t('generateMaintenancePDF.approvedBy'), data.approver?.full_name || 'N/A']);
  }

  if (data.completed_at) {
    requestInfo.push([t('generateMaintenancePDF.completionDate'), formatDateBR(data.completed_at)]);
    requestInfo.push([t('generateMaintenancePDF.completedBy'), data.completer?.full_name || 'N/A']);
  }

  requestInfo.forEach(([label, value]) => {
    yPos = addInfoRow(doc, label, value, yPos);
  });

  yPos += 8;

  // Equipment info section
  yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.equipmentData'));
  yPos += 8;

  const equipmentInfo = [
    [t('generateMaintenancePDF.internalCode'), data.equipment?.internal_code || 'N/A'],
    [t('generateMaintenancePDF.name'), data.equipment?.name || 'N/A'],
    [t('generateMaintenancePDF.serialNumber'), data.equipment?.serial_number || 'N/A'],
    [t('generateMaintenancePDF.manufacturer'), data.equipment?.manufacturer || 'N/A'],
    [t('generateMaintenancePDF.model'), data.equipment?.model || 'N/A'],
    [t('generateMaintenancePDF.location'), data.equipment?.location || 'N/A'],
    [t('generateMaintenancePDF.unit'), data.ships?.name || 'N/A'],
  ];

  equipmentInfo.forEach(([label, value]) => {
    yPos = addInfoRow(doc, label, value, yPos);
  });

  yPos += 8;

  // Problem description section
  yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.problemDescription'));
  yPos += 8;

  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`${t('generateMaintenancePDF.title')}:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.title, 40, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.text(`${t('generateMaintenancePDF.description')}:`, 14, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  
  const descriptionLines = doc.splitTextToSize(data.description, pageWidth - 28);
  doc.text(descriptionLines, 14, yPos);
  yPos += descriptionLines.length * 5 + 5;

  if (data.problem_identified) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${t('generateMaintenancePDF.problemIdentified')}:`, 14, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const problemLines = doc.splitTextToSize(data.problem_identified, pageWidth - 28);
    doc.text(problemLines, 14, yPos);
    yPos += problemLines.length * 5 + 5;
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Photos section - LARGER photos for better visibility
  if (data.photos && data.photos.length > 0) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.photos'));
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(t('generateMaintenancePDF.photosAttached', { count: data.photos.length }), 14, yPos);
    yPos += 8;

    // Larger photo dimensions for better visibility
    const photoWidth = 85;
    const photoHeight = 65;
    const photosPerRow = 2;
    let photoX = 14;
    let photoCount = 0;

    for (const photo of data.photos) {
      // Check if we need a new page
      if (yPos > 210) {
        doc.addPage();
        yPos = 20;
        photoX = 14;
      }

      try {
        const base64 = await loadPhotoAsBase64(photo.file_path);
        if (base64) {
          doc.addImage(base64, 'JPEG', photoX, yPos, photoWidth, photoHeight);
        } else {
          // Placeholder for failed image
          doc.setDrawColor(...MEDIUM_GRAY);
          doc.setFillColor(248, 250, 252);
          doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
          doc.setFontSize(8);
          doc.setTextColor(...MEDIUM_GRAY);
          doc.text(t('generateMaintenancePDF.imageNotAvailable'), photoX + 20, yPos + 32);
        }
      } catch {
        doc.setDrawColor(...MEDIUM_GRAY);
        doc.setFillColor(248, 250, 252);
        doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(...MEDIUM_GRAY);
        doc.text(t('generateMaintenancePDF.imageNotAvailable'), photoX + 20, yPos + 32);
      }

      photoCount++;
      if (photoCount % photosPerRow === 0) {
        photoX = 14;
        yPos += photoHeight + 8;
      } else {
        photoX += photoWidth + 8;
      }
    }

    // Move to next row if photos don't fill the row
    if (photoCount % photosPerRow !== 0) {
      yPos += photoHeight + 8;
    }
  }

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Work performed section (if completed)
  if (data.work_performed) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.workPerformed'));
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...DARK_GRAY);
    const workLines = doc.splitTextToSize(data.work_performed, pageWidth - 28);
    doc.text(workLines, 14, yPos);
    yPos += workLines.length * 5 + 5;

    if (data.parts_used) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${t('generateMaintenancePDF.partsUsed')}:`, 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const partsLines = doc.splitTextToSize(data.parts_used, pageWidth - 28);
      doc.text(partsLines, 14, yPos);
      yPos += partsLines.length * 5 + 5;
    }

    if (data.observations) {
      doc.setFont('helvetica', 'bold');
      doc.text(`${t('generateMaintenancePDF.observations')}:`, 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(data.observations, pageWidth - 28);
      doc.text(obsLines, 14, yPos);
      yPos += obsLines.length * 5 + 5;
    }
  }

  // Rejection reason (if rejected)
  if (data.rejection_reason) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.rejectionReason'));
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...DANGER_RED);
    const rejectionLines = doc.splitTextToSize(data.rejection_reason, pageWidth - 28);
    doc.text(rejectionLines, 14, yPos);
    doc.setTextColor(...DARK_GRAY);
    yPos += rejectionLines.length * 5 + 5;
  }

  // Check if we need a new page for history
  if (yPos > 200 && data.history && data.history.length > 0) {
    doc.addPage();
    yPos = 20;
  }

  // Maintenance history section
  if (data.history && data.history.length > 0) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, t('generateMaintenancePDF.maintenanceHistory'));
    yPos += 8;

    const historyData = data.history.map(h => [
      labels.type[h.type] || h.type,
      labels.status[h.status] || h.status,
      h.title.substring(0, 40) + (h.title.length > 40 ? '...' : ''),
      h.completed_at ? formatDateBR(h.completed_at) : '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [[
        t('generateMaintenancePDF.tableType'),
        t('generateMaintenancePDF.tableStatus'),
        t('generateMaintenancePDF.tableTitle'),
        t('generateMaintenancePDF.tableCompletion')
      ]],
      body: historyData,
      theme: 'striped',
      headStyles: { 
        fillColor: SBM_BLUE,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: { 
        fontSize: 8,
        textColor: DARK_GRAY,
        cellPadding: 3,
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252] 
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Type
        1: { cellWidth: 28 }, // Status
        2: { cellWidth: 'auto' }, // Title
        3: { cellWidth: 28 }, // Completion Date
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Add footer with organization name
  const companyName = data.branding?.name || 'HSSE Connect';
  addPDFFooter(doc, `${companyName} - ${t('generateMaintenancePDF.footerSubtitle')}`, formatMaintenanceId(data.id));

  // Save or Preview
  const fileName = `${t('generateMaintenancePDF.filePrefix')}_${formatMaintenanceId(data.id).replace('-', '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(fileName);
  }
}
