import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, addSectionHeader, SBM_BLUE, DARK_GRAY, DANGER_RED, MEDIUM_GRAY } from './pdfStyles';
import type { MaintenanceRequestWithDetails, MaintenancePhoto } from '@/hooks/useMaintenanceRequests';
import { supabase } from '@/integrations/supabase/client';

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
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  in_progress: 'Em Execução',
  completed: 'Concluída',
  rejected: 'Rejeitada',
};

const typeLabels: Record<string, string> = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
};

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

function formatDateBR(date: string | null | undefined): string {
  if (!date) return 'N/A';
  return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
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

export async function generateMaintenancePDF(data: MaintenanceDetailData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  
  // Add header
  await addPDFHeader(doc, 'Relatório de Manutenção', formatDateBR(data.requested_at));
  
  let yPos = 50;
  
  // Request info section
  yPos = addSectionHeader(doc, yPos, 'Informações da Solicitação');
  yPos += 8;
  
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  
  const requestInfo = [
    ['Nº Solicitação', data.id.substring(0, 8).toUpperCase()],
    ['Tipo', typeLabels[data.type] || data.type],
    ['Prioridade', priorityLabels[data.priority] || data.priority],
    ['Status', statusLabels[data.status] || data.status],
    ['Data Solicitação', formatDateBR(data.requested_at)],
    ['Solicitante', data.requester?.full_name || 'N/A'],
  ];

  if (data.scheduled_date) {
    requestInfo.push(['Data Agendada', formatDateBR(data.scheduled_date)]);
  }

  if (data.approved_at) {
    requestInfo.push(['Data Aprovação', formatDateBR(data.approved_at)]);
    requestInfo.push(['Aprovado por', data.approver?.full_name || 'N/A']);
  }

  if (data.completed_at) {
    requestInfo.push(['Data Conclusão', formatDateBR(data.completed_at)]);
    requestInfo.push(['Concluído por', data.completer?.full_name || 'N/A']);
  }

  requestInfo.forEach(([label, value]) => {
    yPos = addInfoRow(doc, label, value, yPos);
  });

  yPos += 8;

  // Equipment info section
  yPos = addSectionHeader(doc, yPos, 'Dados do Equipamento');
  yPos += 8;

  const equipmentInfo = [
    ['Código Interno', data.equipment?.internal_code || 'N/A'],
    ['Nome', data.equipment?.name || 'N/A'],
    ['Nº Série', data.equipment?.serial_number || 'N/A'],
    ['Fabricante', data.equipment?.manufacturer || 'N/A'],
    ['Modelo', data.equipment?.model || 'N/A'],
    ['Localização', data.equipment?.location || 'N/A'],
    ['Unidade', data.ships?.name || 'N/A'],
  ];

  equipmentInfo.forEach(([label, value]) => {
    yPos = addInfoRow(doc, label, value, yPos);
  });

  yPos += 8;

  // Problem description section
  yPos = addSectionHeader(doc, yPos, 'Descrição do Problema');
  yPos += 8;

  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Título:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(data.title, 40, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'bold');
  doc.text('Descrição:', 14, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  
  const descriptionLines = doc.splitTextToSize(data.description, pageWidth - 28);
  doc.text(descriptionLines, 14, yPos);
  yPos += descriptionLines.length * 5 + 5;

  if (data.problem_identified) {
    doc.setFont('helvetica', 'bold');
    doc.text('Problema Identificado:', 14, yPos);
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

  // Photos section
  if (data.photos && data.photos.length > 0) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, 'Fotos');
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(`${data.photos.length} foto(s) anexada(s)`, 14, yPos);
    yPos += 8;

    const photoWidth = 55;
    const photoHeight = 40;
    const photosPerRow = 3;
    let photoX = 14;
    let photoCount = 0;

    for (const photo of data.photos) {
      // Check if we need a new page
      if (yPos > 240) {
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
          doc.text('Imagem não disponível', photoX + 5, yPos + 22);
        }
      } catch {
        doc.setDrawColor(...MEDIUM_GRAY);
        doc.setFillColor(248, 250, 252);
        doc.rect(photoX, yPos, photoWidth, photoHeight, 'FD');
        doc.setFontSize(8);
        doc.setTextColor(...MEDIUM_GRAY);
        doc.text('Imagem não disponível', photoX + 5, yPos + 22);
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

  // Check if we need a new page
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  // Work performed section (if completed)
  if (data.work_performed) {
    yPos += 5;
    yPos = addSectionHeader(doc, yPos, 'Trabalho Realizado');
    yPos += 8;

    doc.setFontSize(9);
    doc.setTextColor(...DARK_GRAY);
    const workLines = doc.splitTextToSize(data.work_performed, pageWidth - 28);
    doc.text(workLines, 14, yPos);
    yPos += workLines.length * 5 + 5;

    if (data.parts_used) {
      doc.setFont('helvetica', 'bold');
      doc.text('Peças/Materiais Utilizados:', 14, yPos);
      yPos += 6;
      doc.setFont('helvetica', 'normal');
      const partsLines = doc.splitTextToSize(data.parts_used, pageWidth - 28);
      doc.text(partsLines, 14, yPos);
      yPos += partsLines.length * 5 + 5;
    }

    if (data.observations) {
      doc.setFont('helvetica', 'bold');
      doc.text('Observações:', 14, yPos);
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
    yPos = addSectionHeader(doc, yPos, 'Motivo da Rejeição');
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
    yPos = addSectionHeader(doc, yPos, 'Histórico de Manutenções do Equipamento');
    yPos += 8;

    const historyData = data.history.map(h => [
      typeLabels[h.type] || h.type,
      statusLabels[h.status] || h.status,
      h.title.substring(0, 40) + (h.title.length > 40 ? '...' : ''),
      h.completed_at ? formatDateBR(h.completed_at) : '-',
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Status', 'Título', 'Conclusão']],
      body: historyData,
      theme: 'striped',
      headStyles: { 
        fillColor: SBM_BLUE,
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: { 
        fontSize: 8,
        textColor: DARK_GRAY,
      },
      alternateRowStyles: { 
        fillColor: [248, 250, 252] 
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Add footer
  addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão de Manutenção', 'Documento gerado automaticamente');

  // Save the PDF
  const fileName = `manutencao_${data.id.substring(0, 8)}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  doc.save(fileName);
}
