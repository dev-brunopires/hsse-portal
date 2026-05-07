import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  SBM_BLUE,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  addSignatureSection,
  preloadLogo,
} from './pdfStyles';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

interface EquipmentRow {
  internal_code: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string;
  capacity: string | null;
  unit: string;
  location: string;
  status: string;
  expiry_date: string | null;
  certificate_expiry: string | null;
  next_inspection: string | null;
  last_inspection: string | null;
  last_hydrostatic_test?: string | null;
  next_hydrostatic_test?: string | null;
  last_calibration?: string | null;
  next_calibration?: string | null;
  category_id: string;
  categories?: { name: string; icon: string } | null;
  ships?: { id: string; name: string; code: string | null } | null;
}

interface InspectionInfo {
  equipmentId: string;
  lastInspectionDate: string | null;
  lastInspectorName: string;
  lastInspectionStatus: string;
}

interface ExportOptions {
  preview?: boolean;
  inspector?: { name: string; position?: string };
  signature?: string | null;
}

const statusOrder: Record<string, number> = {
  active: 0,
  maintenance: 1,
  expired: 2,
  rejected: 3,
  inactive: 4,
};

function sortEquipment(equipment: EquipmentRow[]): EquipmentRow[] {
  return [...equipment].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 3;
    const orderB = statusOrder[b.status] ?? 3;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: getDateLocale() });
}

function getStatusLabel(status: string): string {
  const t = i18n.t;
  const labels: Record<string, string> = {
    active: t('reports.statusActive'),
    maintenance: t('reports.statusMaintenance'),
    expired: t('reports.statusExpired'),
    rejected: t('reports.statusRejected'),
    inactive: t('reports.statusInactive'),
  };
  return labels[status] || status;
}

function getInspectionStatusLabel(status: string): string {
  const t = i18n.t;
  const labels: Record<string, string> = {
    compliant: t('inspections.statusCompliant'),
    attention: t('inspections.statusAttention'),
    'non-compliant': t('inspections.statusNonCompliant'),
  };
  return labels[status] || status;
}

export function exportEquipmentByCategoryExcel(
  equipment: EquipmentRow[],
  inspectionMap: Map<string, InspectionInfo>,
  categories: { id: string; name: string }[]
) {
  const t = i18n.t;
  const wb = XLSX.utils.book_new();

  // Group by category
  const grouped = new Map<string, EquipmentRow[]>();
  for (const eq of equipment) {
    const catId = eq.category_id;
    if (!grouped.has(catId)) grouped.set(catId, []);
    grouped.get(catId)!.push(eq);
  }

  // All equipment in one sheet, grouped
  const allRows: Record<string, any>[] = [];

  for (const cat of categories) {
    const catEquipment = grouped.get(cat.id);
    if (!catEquipment || catEquipment.length === 0) continue;

    const sorted = sortEquipment(catEquipment);

    for (const eq of sorted) {
      const insp = inspectionMap.get(eq.internal_code);
      allRows.push({
        [t('reports.category')]: cat.name,
        [t('reports.code')]: eq.internal_code,
        [t('reports.equipment')]: eq.name,
        [t('reports.type')]: eq.type,
        [t('reports.manufacturer')]: eq.manufacturer || '—',
        [t('reports.model')]: eq.model || '—',
        [t('reports.serialNumber')]: eq.serial_number,
        [t('reports.capacity')]: eq.capacity || '—',
        [t('reports.unit')]: eq.unit,
        [t('common.location')]: eq.location,
        [t('reports.status')]: getStatusLabel(eq.status),
        [t('reports.expiryDate')]: formatDate(eq.expiry_date),
        [t('reports.certExpiry')]: formatDate(eq.certificate_expiry),
        [t('reports.nextInspection')]: formatDate(eq.next_inspection),
        [t('reports.lastInspection')]: formatDate(insp?.lastInspectionDate || eq.last_inspection),
        [t('reports.inspector')]: insp?.lastInspectorName || '—',
        [t('reports.inspStatus')]: insp ? getInspectionStatusLabel(insp.lastInspectionStatus) : '—',
        [t('equipmentByCategoryReport.shipName')]: eq.ships?.name || '—',
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(allRows);
  // Auto-size columns
  if (allRows.length > 0) {
    ws['!cols'] = Object.keys(allRows[0]).map(key => ({
      wch: Math.max(key.length, ...allRows.map(row => String(row[key] || '').length)).toString().length > 40 ? 40 : Math.max(key.length + 2, ...allRows.map(row => String(row[key] || '').length))
    }));
  }
  XLSX.utils.book_append_sheet(wb, ws, t('equipmentByCategoryReport.sheetName'));
  XLSX.writeFile(wb, `${t('equipmentByCategoryReport.fileName')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function exportEquipmentByCategoryPDF(
  equipment: EquipmentRow[],
  inspectionMap: Map<string, InspectionInfo>,
  categories: { id: string; name: string }[],
  branding: OrganizationBranding,
  options?: ExportOptions
) {
  const t = i18n.t;
  const dateLocale = getDateLocale();

  await preloadLogo(branding);

  const doc = new jsPDF('landscape');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale });

  // Group by category
  const grouped = new Map<string, EquipmentRow[]>();
  for (const eq of equipment) {
    const catId = eq.category_id;
    if (!grouped.has(catId)) grouped.set(catId, []);
    grouped.get(catId)!.push(eq);
  }

  const totalEquipment = equipment.length;
  const activeCount = equipment.filter(e => e.status === 'active').length;
  const inactiveCount = equipment.filter(e => e.status === 'inactive').length;

  let yPos = await addPDFHeader(
    doc,
    t('equipmentByCategoryReport.title'),
    `${t('common.createdAt')}: ${generatedDate}`,
    [
      `${t('reports.total')}: ${totalEquipment} ${t('reports.equipmentPlural')}`,
      `${t('reports.active')}: ${activeCount} | ${t('reports.statusInactive')}: ${inactiveCount}`,
    ],
    { branding }
  );

  let firstCategory = true;

  for (const cat of categories) {
    const catEquipment = grouped.get(cat.id);
    if (!catEquipment || catEquipment.length === 0) continue;

    const sorted = sortEquipment(catEquipment);

    // Check page space
    const pageHeight = doc.internal.pageSize.getHeight();
    if (!firstCategory && yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    // Category section header
    const catActive = sorted.filter(e => e.status === 'active').length;
    addSectionHeader(doc, yPos, `${cat.name} (${sorted.length} ${t('reports.equipmentPlural')} — ${catActive} ${t('reports.active').toLowerCase()})`);
    yPos += 10;

    const tableData = sorted.map(eq => {
      const insp = inspectionMap.get(eq.internal_code);
      return [
        eq.internal_code,
        eq.name,
        eq.serial_number || '—',
        eq.type || '—',
        eq.location,
        getStatusLabel(eq.status),
        formatDate(eq.certificate_expiry),
        formatDate(insp?.lastInspectionDate || eq.last_inspection),
        insp?.lastInspectorName || '—',
        insp ? getInspectionStatusLabel(insp.lastInspectionStatus) : '—',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [[
        t('reports.code'),
        t('reports.equipment'),
        t('reports.serialNumber'),
        t('reports.type'),
        t('common.location'),
        t('reports.status'),
        t('reports.certExpiry'),
        t('reports.lastInspection'),
        t('reports.inspector'),
        t('reports.inspStatus'),
      ]],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2, minCellHeight: 8 },
      headStyles: { fillColor: SBM_BLUE, fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22 },
        3: { cellWidth: 20 },
        4: { cellWidth: 24 },
        5: { cellWidth: 22 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 28 },
        9: { cellWidth: 22 },
      },
      didDrawPage: () => {
        // Reset yPos on new page
      },
    });

    yPos = (doc as any).lastAutoTable?.finalY + 8 || yPos + 50;
    firstCategory = false;
  }

  // Add signature if provided
  if (options?.inspector) {
    addSignatureSection(
      doc,
      yPos + 5,
      options.inspector.name,
      options.inspector.position,
      options.signature
    );
  }

  // Footer
  const companyName = branding?.name || 'SafeShip';
  addPDFFooter(
    doc,
    `${companyName} - ${t('reports.footerAutoGenerated')}`,
    `${t('equipmentByCategoryReport.title')} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(`${t('equipmentByCategoryReport.fileName')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
}
