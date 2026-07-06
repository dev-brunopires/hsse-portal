import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateFormat';
import { ptBR, enUS } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, addSignatureSection, SBM_BLUE, preloadLogo } from './pdfStyles';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import type { InspectionWithDetails } from '@/hooks/useInspections';
import type { Category } from '@/hooks/useCategories';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

interface MonthlyConsolidatedData {
  category: Category;
  equipment: EquipmentWithCategory[];
  inspections: InspectionWithDetails[];
  monthLabel: string;
  branding?: OrganizationBranding;
  inspector?: {
    name: string;
    position?: string;
  };
  signature?: string;
}

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'compliant': i18n.t('inspections.statusCompliant'),
    'attention': i18n.t('inspections.statusAttention'),
    'non-compliant': i18n.t('inspections.statusNonCompliant'),
    'active': i18n.t('equipment.statusActive'),
    'maintenance': i18n.t('equipment.statusMaintenance'),
    'expired': i18n.t('equipment.statusExpired'),
    'rejected': i18n.t('equipment.statusRejected'),
  };
  return labels[status] || status;
};

export async function exportMonthlyConsolidatedPDF(
  data: MonthlyConsolidatedData,
  options?: { preview?: boolean }
): Promise<void> {
  const t = i18n.t;
  const dateLocale = getDateLocale();
  
  await preloadLogo(data.branding);
  
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  
  // Header
  let yPos = await addPDFHeader(
    doc,
    t('reports.monthlyConsolidatedTitle'),
    `${data.category.name} - ${data.monthLabel}`,
    [
      `${t('reports.total')}: ${data.equipment.length} ${t('reports.equipmentPlural')}`,
      `${t('reports.inspectionsPerformed')}: ${data.inspections.length}`
    ],
    { branding: data.branding }
  );

  yPos += 8;

  // Summary Box
  const compliant = data.inspections.filter(i => i.status === 'compliant').length;
  const attention = data.inspections.filter(i => i.status === 'attention').length;
  const nonCompliant = data.inspections.filter(i => i.status === 'non-compliant').length;
  const notInspected = data.equipment.length - data.inspections.length;

  doc.setFillColor(248, 249, 250);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 20, 2, 2, 'F');
  
  const boxWidth = (pageWidth - margin * 2) / 4;
  
  doc.setFontSize(10);
  doc.setTextColor(40, 167, 69);
  doc.text(`${t('reports.compliant')}: ${compliant}`, margin + boxWidth * 0.5, yPos + 12, { align: 'center' });
  
  doc.setTextColor(255, 193, 7);
  doc.text(`${t('reports.attention')}: ${attention}`, margin + boxWidth * 1.5, yPos + 12, { align: 'center' });
  
  doc.setTextColor(220, 53, 69);
  doc.text(`${t('reports.nonCompliant')}: ${nonCompliant}`, margin + boxWidth * 2.5, yPos + 12, { align: 'center' });
  
  doc.setTextColor(108, 117, 125);
  doc.text(`${t('reports.notInspected')}: ${notInspected}`, margin + boxWidth * 3.5, yPos + 12, { align: 'center' });

  yPos += 28;

  // Equipment Table with Inspections
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(33, 37, 41);
  doc.text(t('reports.equipmentWithInspections'), margin, yPos);
  yPos += 5;

  const tableData = data.equipment.map(equip => {
    const equipInspections = data.inspections.filter(i => i.equipment_id === equip.id);
    const lastInspection = equipInspections.sort((a, b) => 
      new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
    )[0];

    return [
      equip.internal_code,
      equip.name,
      equip.location || '—',
      getStatusLabel(equip.status),
      equipInspections.length.toString(),
      lastInspection 
        ? format(parseLocalDate(lastInspection.inspection_date)!, 'dd/MM/yy', { locale: dateLocale })
        : '—',
      lastInspection 
        ? getStatusLabel(lastInspection.status)
        : '—',
      lastInspection?.profiles?.full_name || '—',
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('reports.code'),
      t('reports.equipment'),
      t('common.location'),
      t('reports.eqStatus'),
      t('reports.inspCount'),
      t('reports.lastInspection'),
      t('reports.inspStatus'),
      t('reports.inspector'),
    ]],
    body: tableData,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: SBM_BLUE,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [33, 37, 41],
      cellPadding: 4,
      minCellHeight: 10,
    },
    alternateRowStyles: {
      fillColor: [248, 249, 250],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 32 },
      3: { cellWidth: 24 },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
      6: { cellWidth: 26 },
      7: { cellWidth: 40 },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'body') {
        // Equipment status column
        if (hookData.column.index === 3) {
          const equip = data.equipment[hookData.row.index];
          if (equip?.status === 'active') {
            hookData.cell.styles.textColor = [40, 167, 69];
          } else if (equip?.status === 'expired' || equip?.status === 'rejected') {
            hookData.cell.styles.textColor = [220, 53, 69];
          }
        }
        // Inspection status column
        if (hookData.column.index === 6) {
          const cellText = hookData.cell.text[0];
          if (cellText === getStatusLabel('compliant')) {
            hookData.cell.styles.textColor = [40, 167, 69];
          } else if (cellText === getStatusLabel('attention')) {
            hookData.cell.styles.textColor = [255, 193, 7];
          } else if (cellText === getStatusLabel('non-compliant')) {
            hookData.cell.styles.textColor = [220, 53, 69];
          }
        }
      }
    },
  });

  // Signature
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  if (data.inspector) {
    addSignatureSection(
      doc,
      finalY + 10,
      data.inspector.name,
      data.inspector.position,
      data.signature
    );
  }

  // Footer
  addPDFFooter(
    doc,
    `${data.branding?.name || 'HSSE Connect'} © ${new Date().getFullYear()}`,
    `${t('reports.monthlyConsolidatedTitle')} - ${data.category.name} - ${data.monthLabel}`
  );

  const fileName = `relatorio_mensal_${data.category.name.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;

  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(fileName);
  }
}

export function exportMonthlyConsolidatedExcel(
  data: MonthlyConsolidatedData
): void {
  const t = i18n.t;
  const dateLocale = getDateLocale();

  const rows = data.equipment.map(equip => {
    const equipInspections = data.inspections.filter(i => i.equipment_id === equip.id);
    const lastInspection = equipInspections.sort((a, b) =>
      new Date(b.inspection_date).getTime() - new Date(a.inspection_date).getTime()
    )[0];

    return {
      [t('reports.code')]: equip.internal_code,
      [t('reports.equipment')]: equip.name,
      [t('common.location')]: equip.location || '—',
      [t('reports.eqStatus')]: getStatusLabel(equip.status),
      [t('reports.inspCount')]: equipInspections.length,
      [t('reports.lastInspection')]: lastInspection
        ? format(parseLocalDate(lastInspection.inspection_date)!, 'dd/MM/yyyy', { locale: dateLocale })
        : '—',
      [t('reports.inspStatus')]: lastInspection ? getStatusLabel(lastInspection.status) : '—',
      [t('reports.inspector')]: lastInspection?.profiles?.full_name || '—',
      [t('common.observations')]: lastInspection?.observations || '—',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, data.category.name.substring(0, 31));

  // Auto-size columns
  const maxWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(row => String(row[key as keyof typeof row] || '').length))
  }));
  ws['!cols'] = maxWidths;

  const fileName = `relatorio_mensal_${data.category.name.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
