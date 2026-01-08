import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { AuditLog } from '@/hooks/useAuditLogs';
import { addPDFHeader, addPDFFooter, SBM_BLUE, DARK_GRAY, MEDIUM_GRAY, preloadLogo } from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

const t = (key: string) => i18n.t(`exportAuditLogs.${key}`);
const getDateLocale = () => i18n.language === 'pt-BR' ? ptBR : enUS;

const getActionLabels = (): Record<string, string> => ({
  INSERT: t('actionInsert'),
  UPDATE: t('actionUpdate'),
  DELETE: t('actionDelete'),
});

const getTableLabels = (): Record<string, string> => ({
  equipment: t('tableEquipment'),
  inspections: t('tableInspection'),
  categories: t('tableCategory'),
  ships: t('tableShip'),
  profiles: t('tableProfile'),
});

export async function exportAuditLogsPDF(
  logs: AuditLog[], 
  filters?: { ship?: string; table?: string; action?: string },
  branding?: OrganizationBranding,
  options?: { preview?: boolean }
) {
  // Preload logo with branding
  await preloadLogo(branding);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dateLocale = getDateLocale();
  const actionLabels = getActionLabels();
  const tableLabels = getTableLabels();

  // Build filter info for header
  const filterParts: string[] = [];
  if (filters?.ship) filterParts.push(`${t('filterShip')}: ${filters.ship}`);
  if (filters?.table) filterParts.push(`${t('filterType')}: ${tableLabels[filters.table] || filters.table}`);
  if (filters?.action) filterParts.push(`${t('filterAction')}: ${actionLabels[filters.action] || filters.action}`);

  const rightText = filterParts.length > 0 ? filterParts : [t('allRecords')];

  // Add header with branding
  const startY = await addPDFHeader(
    doc,
    t('title'),
    format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale }),
    rightText,
    { branding }
  );

  // Stats
  doc.setFontSize(11);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`${t('totalRecords')}: ${logs.length}`, margin, startY + 5);

  // Table
  const tableData = logs.map(log => [
    format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale }),
    tableLabels[log.table_name] || log.table_name,
    actionLabels[log.action] || log.action,
    log.user_name || t('system'),
    getChangeSummary(log),
  ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [[t('headerDateTime'), t('headerType'), t('headerAction'), t('headerUser'), t('headerSummary')]],
    body: tableData,
    headStyles: {
      fillColor: SBM_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: DARK_GRAY,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  });

  // Add footer
  const companyName = branding?.name || t('footerCompany');
  addPDFFooter(doc, companyName, t('title'));

  const pdfFileName = `${t('fileName')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(pdfFileName);
  }
}

export function exportAuditLogsExcel(logs: AuditLog[], filters?: { ship?: string; table?: string; action?: string }) {
  const dateLocale = getDateLocale();
  const actionLabels = getActionLabels();
  const tableLabels = getTableLabels();

  const data = logs.map(log => ({
    [t('headerDateTime')]: format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: dateLocale }),
    [t('excelRecordType')]: tableLabels[log.table_name] || log.table_name,
    [t('headerAction')]: actionLabels[log.action] || log.action,
    [t('headerUser')]: log.user_name || t('system'),
    [t('headerSummary')]: getChangeSummary(log),
    [t('excelChangedFields')]: log.changed_fields?.join(', ') || '-',
    [t('excelRecordId')]: log.record_id,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 12 },
    { wch: 25 },
    { wch: 40 },
    { wch: 30 },
    { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('sheetHistory'));

  // Add info sheet
  const infoData = [
    [t('excelReportTitle')],
    [''],
    [t('excelGeneratedAt'), format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale })],
    [t('totalRecords'), logs.length.toString()],
    [''],
    [t('excelFiltersApplied')],
    [t('filterShip'), filters?.ship || t('filterAll')],
    [t('filterType'), filters?.table ? (tableLabels[filters.table] || filters.table) : t('filterAll')],
    [t('filterAction'), filters?.action ? (actionLabels[filters.action] || filters.action) : t('filterAll')],
  ];

  const infoWs = XLSX.utils.aoa_to_sheet(infoData);
  infoWs['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, infoWs, t('sheetInfo'));

  XLSX.writeFile(wb, `${t('fileName')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

function getChangeSummary(log: AuditLog): string {
  const fieldLabels: Record<string, string> = {
    name: t('fieldName'),
    internal_code: t('fieldInternalCode'),
    status: t('fieldStatus'),
    category_id: t('fieldCategory'),
    ship_id: t('fieldShip'),
    location: t('fieldLocation'),
    manufacturer: t('fieldManufacturer'),
    model: t('fieldModel'),
    serial_number: t('fieldSerialNumber'),
    acquisition_date: t('fieldAcquisitionDate'),
    manufacturing_date: t('fieldManufacturingDate'),
    expiry_date: t('fieldExpiryDate'),
    certificate_expiry: t('fieldCertificateExpiry'),
    next_inspection: t('fieldNextInspection'),
    last_inspection: t('fieldLastInspection'),
    observations: t('fieldObservations'),
    inspection_date: t('fieldInspectionDate'),
    inspector_id: t('fieldInspector'),
    recommendations: t('fieldRecommendations'),
    actions_taken: t('fieldActionsTaken'),
    full_name: t('fieldFullName'),
    email: t('fieldEmail'),
    phone: t('fieldPhone'),
    position: t('fieldPosition'),
    department: t('fieldDepartment'),
    description: t('fieldDescription'),
    icon: t('fieldIcon'),
    inspection_frequency: t('fieldInspectionFrequency'),
    code: t('fieldCode'),
  };

  if (log.action === 'INSERT') return t('recordCreated');
  if (log.action === 'DELETE') return t('recordDeleted');
  if (log.changed_fields && log.changed_fields.length > 0) {
    const fieldNames = log.changed_fields
      .filter(f => f !== 'updated_at')
      .map(f => fieldLabels[f] || f)
      .slice(0, 3);
    const remaining = log.changed_fields.length - 3;
    return fieldNames.join(', ') + (remaining > 0 ? ` ${t('andMore')} ${remaining}` : '');
  }
  return t('changesPerformed');
}
