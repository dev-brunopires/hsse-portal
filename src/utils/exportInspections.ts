import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

export async function exportInspectionsToPDF(inspections: InspectionWithDetails[], filename = 'relatorio_inspecoes') {
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF('landscape');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO DE INSPEÇÕES',
    `Gerado em: ${generatedDate}`,
    [`Total: ${inspections.length} inspeções`]
  );

  // Summary
  const approved = inspections.filter(i => i.status === 'approved').length;
  const rejected = inspections.filter(i => i.status === 'rejected').length;
  const pending = inspections.filter(i => i.status === 'pending').length;
  
  // Add summary section
  yPos = addSectionHeader(doc, yPos, 'RESUMO', SBM_BLUE);
  yPos += 2;
  
  doc.setFontSize(9);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Aprovadas: ${approved} | Reprovadas: ${rejected} | Pendentes: ${pending}`, 14, yPos + 4);
  yPos += 12;

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
    startY: yPos,
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
    headStyles: { fillColor: SBM_BLUE },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add standardized footer
  addPDFFooter(
    doc,
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório de Inspeções - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export async function exportSingleInspectionPDF(
  inspection: InspectionWithDetails, 
  checklistItems: { description: string; status: string; notes: string | null }[] = [],
  photos: InspectionPhoto[] = []
) {
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO DE INSPEÇÃO',
    `Documento: INS-${inspection.id.substring(0, 8).toUpperCase()}`,
    [`Emitido: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`]
  );
  
  // Inspection info section
  yPos = addSectionHeader(doc, yPos, 'DADOS DA INSPEÇÃO', SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Data: ${format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: ptBR })}`, 14, yPos);
  doc.text(`Status: ${statusLabels[inspection.status] || inspection.status}`, 100, yPos);
  yPos += 6;
  doc.text(`Inspetor: ${inspection.profiles?.full_name || '—'}`, 14, yPos);
  doc.text(`Email: ${inspection.profiles?.email || '—'}`, 100, yPos);
  yPos += 10;
  
  // Equipment info section - expanded with more details
  yPos = addSectionHeader(doc, yPos, 'EQUIPAMENTO', SBM_BLUE);
  yPos += 4;
  
  doc.setFontSize(10);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Nome: ${inspection.equipment?.name || '—'}`, 14, yPos);
  doc.text(`Código: ${inspection.equipment?.internal_code || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`Nº Série: ${inspection.equipment?.serial_number || '—'}`, 14, yPos);
  doc.text(`Tipo: ${inspection.equipment?.type || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`Fabricante: ${inspection.equipment?.manufacturer || '—'}`, 14, yPos);
  doc.text(`Modelo: ${inspection.equipment?.model || '—'}`, 100, yPos);
  yPos += 6;
  doc.text(`Localização: ${inspection.equipment?.location || '—'}`, 14, yPos);
  doc.text(`Capacidade: ${inspection.equipment?.capacity || '—'}`, 100, yPos);
  yPos += 10;
  
  // Checklist section
  if (checklistItems.length > 0) {
    yPos = addSectionHeader(doc, yPos, 'CHECKLIST DE INSPEÇÃO', SBM_BLUE);
    
    const checklistStatusLabels: Record<string, string> = {
      ok: 'Conforme',
      fail: 'Não Conforme',
      pending: 'Pendente',
    };
    
    autoTable(doc, {
      startY: yPos + 2,
      head: [['Item', 'Status', 'Observações']],
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
    yPos = addSectionHeader(doc, yPos, 'OBSERVAÇÕES', SBM_BLUE);
    yPos += 4;
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(inspection.observations, 180);
    doc.text(lines, 14, yPos);
    yPos += lines.length * 5 + 6;
  }
  
  // Recommendations section
  if (inspection.recommendations) {
    yPos = addSectionHeader(doc, yPos, 'RECOMENDAÇÕES', SBM_BLUE);
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

    yPos = addSectionHeader(doc, yPos, 'FOTOS', SBM_BLUE);
    yPos += 4;

    doc.setFontSize(9);
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(`${photos.length} foto(s) anexada(s)`, 14, yPos);
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
  
  // Signature section
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }
  
  yPos = addSectionHeader(doc, yPos, 'ASSINATURA', SBM_BLUE);
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
      doc.text('Assinatura digital registrada', 24, yPos + 16);
    }
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text('Aguardando assinatura', 28, yPos + 16);
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
    doc.text(`Assinado em: ${format(new Date(inspection.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, detailsX, yPos + 22);
  }

  // Add standardized footer
  addPDFFooter(
    doc,
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório de Inspeção - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  doc.save(`inspecao_${inspection.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
