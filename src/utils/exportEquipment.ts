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
      [t('equipmentForm.lastHydrostaticTest', 'Último teste hidrostático')]: formatDate((item as any).last_hydrostatic_test),
      [t('equipmentForm.nextHydrostaticTest', 'Próximo teste hidrostático')]: formatDate((item as any).next_hydrostatic_test),
      [t('equipmentForm.lastCalibration', 'Última calibração')]: formatDate((item as any).last_calibration),
      [t('equipmentForm.nextCalibration', 'Próxima calibração')]: formatDate((item as any).next_calibration),
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

  // Table 1: Equipment Identification
  addSectionHeader(doc, yPos, t('exportEquipment.identificationSection'));
  yPos += 14;

  const identificationData = equipment.map(item => [
    item.internal_code,
    item.name,
    item.categories?.name || '—',
    item.type || '—',
    item.manufacturer || '—',
    item.model || '—',
    item.serial_number || '—',
    item.capacity || '—',
    item.location || '—',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('exportEquipment.code'),
      t('exportEquipment.name'),
      t('exportEquipment.category'),
      t('exportEquipment.type'),
      t('exportEquipment.manufacturer'),
      t('exportEquipment.model'),
      t('exportEquipment.serialNumber'),
      t('exportEquipment.capacity'),
      t('exportEquipment.location'),
    ]],
    body: identificationData,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: SBM_BLUE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26 }, // Code
      1: { cellWidth: 'auto' }, // Name
      2: { cellWidth: 28 }, // Category
      3: { cellWidth: 24 }, // Type
      4: { cellWidth: 28 }, // Manufacturer
      5: { cellWidth: 24 }, // Model
      6: { cellWidth: 28 }, // Serial
      7: { cellWidth: 22 }, // Capacity
      8: { cellWidth: 28 }, // Location
    },
  });

  // Get current Y position after first table
  const firstTableFinalY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  yPos = firstTableFinalY + 10;

  // Check if we need a new page for the second table
  const pageHeight = doc.internal.pageSize.getHeight();
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 20;
  }

  // Table 2: Dates and Status
  addSectionHeader(doc, yPos, t('exportEquipment.datesSection'));
  yPos += 14;

  const datesStatusData = equipment.map(item => {
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
      statusWithAlerts,
      formatDate(item.manufacturing_date),
      formatDate(item.acquisition_date),
      formatDate(item.expiry_date),
      formatDate(item.certificate_expiry),
      formatDate(item.last_inspection),
      formatDate(item.next_inspection),
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [[
      t('exportEquipment.code'),
      t('exportEquipment.status'),
      t('exportEquipment.manufacturingDate'),
      t('exportEquipment.acquisitionDate'),
      t('exportEquipment.expiryDate'),
      t('exportEquipment.certificateExpiry'),
      t('exportEquipment.lastInsp'),
      t('exportEquipment.nextInsp'),
    ]],
    body: datesStatusData,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: SBM_BLUE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 26 }, // Code
      1: { cellWidth: 48 }, // Status with alerts
      2: { cellWidth: 28 }, // Manufacturing
      3: { cellWidth: 28 }, // Acquisition
      4: { cellWidth: 28 }, // Expiry
      5: { cellWidth: 28 }, // Certificate
      6: { cellWidth: 26 }, // Last Insp
      7: { cellWidth: 26 }, // Next Insp
    },
  });

  // Table 3: Hydrostatic tests & Calibrations (only if any equipment has data)
  const hasTestData = equipment.some((it: any) =>
    it.last_hydrostatic_test || it.next_hydrostatic_test || it.last_calibration || it.next_calibration
  );

  if (hasTestData) {
    yPos = (doc as any).lastAutoTable?.finalY + 10 || yPos + 50;
    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = 20;
    }

    addSectionHeader(doc, yPos, t('exportEquipment.testsSection', 'Testes e Calibrações'));
    yPos += 14;

    const testsData = equipment.map((item: any) => [
      item.internal_code,
      item.name,
      formatDate(item.last_hydrostatic_test),
      formatDate(item.next_hydrostatic_test),
      formatDate(item.last_calibration),
      formatDate(item.next_calibration),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [[
        t('exportEquipment.code'),
        t('exportEquipment.name'),
        t('equipmentForm.lastHydrostaticTest', 'Último teste hidrostático'),
        t('equipmentForm.nextHydrostaticTest', 'Próximo teste hidrostático'),
        t('equipmentForm.lastCalibration', 'Última calibração'),
        t('equipmentForm.nextCalibration', 'Próxima calibração'),
      ]],
      body: testsData,
      styles: { fontSize: 7, cellPadding: 3 },
      headStyles: { fillColor: SBM_BLUE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 36 },
        3: { cellWidth: 36 },
        4: { cellWidth: 32 },
        5: { cellWidth: 32 },
      },
    });
  }

  // Add standardized footer with organization name
  const companyName = branding?.name || 'HSSE Connect';
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
