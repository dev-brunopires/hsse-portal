import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import {
  SBM_BLUE,
  DARK_GRAY,
  LIGHT_GRAY,
  MEDIUM_GRAY,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  preloadLogo,
} from './pdfStyles';
import { formatStatusWithAlerts, getEquipmentAlerts } from './equipmentStatus';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

const getStatusLabels = (): Record<string, string> => ({
  active: i18n.t('exportEquipment.statusActive'),
  maintenance: i18n.t('exportEquipment.statusMaintenance'),
  expired: i18n.t('exportEquipment.statusExpired'),
  rejected: i18n.t('exportEquipment.statusRejected'),
  inactive: i18n.t('exportEquipment.statusInactive'),
});

const getAlertLabels = () => ({
  certificateExpired: i18n.t('alerts.reportCertExpired'),
  certificateExpiring: i18n.t('alerts.reportCertExpiring'),
  equipmentExpired: i18n.t('alerts.reportEquipExpired'),
  inspectionOverdue: i18n.t('alerts.reportInspOverdue'),
  inspectionDueSoon: i18n.t('alerts.reportInspDueSoon'),
});

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: getDateLocale() });
};

export function exportToExcel(equipment: EquipmentWithCategory[], filename = 'equipamentos') {
  const statusLabels = getStatusLabels();
  const alertLabels = getAlertLabels();
  const t = i18n.t;
  
  const data = equipment.map(item => {
    // Get status with alerts
    const statusWithAlerts = formatStatusWithAlerts(
      item.status,
      {
        status: item.status,
        certificate_expiry: item.certificate_expiry,
        expiry_date: item.expiry_date,
        next_inspection: item.next_inspection
      },
      statusLabels,
      alertLabels
    );
    
    return {
      [t('exportEquipment.internalCode')]: item.internal_code,
      [t('exportEquipment.name')]: item.name,
      [t('exportEquipment.category')]: item.categories?.name || '—',
      [t('exportEquipment.type')]: item.type,
      [t('exportEquipment.manufacturer')]: item.manufacturer,
      [t('exportEquipment.model')]: item.model,
      [t('exportEquipment.serialNumber')]: item.serial_number,
      [t('exportEquipment.capacity')]: item.capacity || '—',
      [t('exportEquipment.unit')]: item.unit,
      [t('exportEquipment.location')]: item.location,
      [t('exportEquipment.status')]: statusWithAlerts,
      [t('exportEquipment.manufacturingDate')]: formatDate(item.manufacturing_date),
      [t('exportEquipment.acquisitionDate')]: formatDate(item.acquisition_date),
      [t('exportEquipment.expiryDate')]: formatDate(item.expiry_date),
      [t('exportEquipment.certificateExpiry')]: formatDate(item.certificate_expiry),
      [t('exportEquipment.lastInspection')]: formatDate(item.last_inspection),
      [t('exportEquipment.nextInspection')]: formatDate(item.next_inspection),
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('exportEquipment.sheetName'));
  
  // Auto-size columns
  const maxWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length))
  }));
  ws['!cols'] = maxWidths;

  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function exportToPDF(
  equipment: EquipmentWithCategory[], 
  filename = 'equipamentos',
  branding?: OrganizationBranding,
  options?: { preview?: boolean }
) {
  const statusLabels = getStatusLabels();
  const t = i18n.t;
  const dateLocale = getDateLocale();
  // Preload logo with branding
  await preloadLogo(branding);
  
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: dateLocale });
  
  // Add standardized header with logo and branding
  let yPos = await addPDFHeader(
    doc,
    t('exportEquipment.reportTitle'),
    `${t('exportEquipment.generatedAt')}: ${generatedDate}`,
    [`${t('exportEquipment.total')}: ${equipment.length} ${t('exportEquipment.equipmentPlural')}`],
    { branding }
  );

  const alertLabels = getAlertLabels();

  const tableData = equipment.map(item => {
    // Get status with alerts for PDF
    const statusWithAlerts = formatStatusWithAlerts(
      item.status,
      {
        status: item.status,
        certificate_expiry: item.certificate_expiry,
        expiry_date: item.expiry_date,
        next_inspection: item.next_inspection
      },
      statusLabels,
      alertLabels
    );
    
    return [
      item.internal_code,
      item.name,
      item.categories?.name || '—',
      item.capacity || '—',
      item.location,
      statusWithAlerts,
      formatDate(item.last_inspection),
      formatDate(item.next_inspection),
      formatDate(item.certificate_expiry),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('exportEquipment.code'),
      t('exportEquipment.name'),
      t('exportEquipment.category'),
      t('exportEquipment.capacity'),
      t('exportEquipment.location'),
      t('exportEquipment.status'),
      t('exportEquipment.lastInsp'),
      t('exportEquipment.nextInsp'),
      t('exportEquipment.certExpiry')
    ]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: SBM_BLUE },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      5: { cellWidth: 45 } // Status column wider to accommodate alerts
    }
  });

  // Add standardized footer with organization name
  const companyName = branding?.name || 'SafeShip';
  addPDFFooter(
    doc,
    t('exportEquipment.footerCompany', { companyName }),
    `${t('exportEquipment.reportTitle')} - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
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
