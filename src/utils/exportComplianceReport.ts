import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { addPDFHeader, addPDFFooter, SBM_BLUE, DARK_GRAY, preloadLogo } from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(`complianceReport.${key}`, options);
const getDateLocale = () => i18n.language === 'pt-BR' ? ptBR : enUS;

interface EquipmentData {
  id: string;
  name: string;
  internal_code: string;
  status: string;
  location?: string;
  certificate_expiry?: string | null;
  next_inspection?: string | null;
  last_inspection?: string | null;
  ship?: { name: string } | null;
  categories?: { name: string } | null;
}

interface CertificateData {
  id: string;
  name: string;
  equipment_id: string;
  status: string;
  expiry_date?: string | null;
  equipment?: { name: string; internal_code: string } | null;
}

interface ComplianceStats {
  totalEquipment: number;
  activeEquipment: number;
  inactiveEquipment: number;
  maintenanceEquipment: number;
  rejectedEquipment: number;
  totalCertificates: number;
  validCertificates: number;
  expiringSoonCertificates: number;
  expiredCertificates: number;
  overdueInspections: number;
  upcomingInspections: number;
}

function calculateStats(equipment: EquipmentData[], certificates: CertificateData[]): ComplianceStats {
  const today = new Date();
  
  return {
    totalEquipment: equipment.length,
    activeEquipment: equipment.filter(e => e.status === 'active').length,
    inactiveEquipment: equipment.filter(e => e.status === 'inactive').length,
    maintenanceEquipment: equipment.filter(e => e.status === 'maintenance').length,
    rejectedEquipment: equipment.filter(e => e.status === 'rejected').length,
    totalCertificates: certificates.length,
    validCertificates: certificates.filter(c => c.status === 'valid').length,
    expiringSoonCertificates: certificates.filter(c => c.status === 'expiring_soon').length,
    expiredCertificates: certificates.filter(c => c.status === 'expired').length,
    overdueInspections: equipment.filter(e => {
      if (!e.next_inspection) return false;
      return differenceInDays(parseISO(e.next_inspection), today) < 0;
    }).length,
    upcomingInspections: equipment.filter(e => {
      if (!e.next_inspection) return false;
      const days = differenceInDays(parseISO(e.next_inspection), today);
      return days >= 0 && days <= 30;
    }).length,
  };
}

function getComplianceLevel(equipment: EquipmentData, certificates: CertificateData[]): string {
  const today = new Date();
  const issues: string[] = [];
  
  // Check equipment status
  if (equipment.status === 'rejected') return '❌ ' + t('nonCompliant');
  if (equipment.status === 'inactive') issues.push(t('inactive'));
  if (equipment.status === 'maintenance') issues.push(t('inMaintenance'));
  
  // Check certificate expiry
  if (equipment.certificate_expiry) {
    const days = differenceInDays(parseISO(equipment.certificate_expiry), today);
    if (days < 0) return '❌ ' + t('expiredCertificate');
    if (days <= 30) issues.push(t('certificateExpiringSoon'));
  }
  
  // Check inspection
  if (equipment.next_inspection) {
    const days = differenceInDays(parseISO(equipment.next_inspection), today);
    if (days < 0) issues.push(t('inspectionOverdue'));
    else if (days <= 7) issues.push(t('inspectionDueSoon'));
  }
  
  if (issues.length === 0) return '✅ ' + t('compliant');
  if (issues.length === 1) return '⚠️ ' + issues[0];
  return '⚠️ ' + t('multipleIssues', { count: issues.length });
}

export async function exportComplianceReportPDF(
  equipment: EquipmentData[],
  certificates: CertificateData[],
  branding?: OrganizationBranding,
  options?: { preview?: boolean; shipName?: string }
) {
  await preloadLogo(branding);
  
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dateLocale = getDateLocale();
  const stats = calculateStats(equipment, certificates);

  // Header
  const rightText: string[] = options?.shipName 
    ? [t('ship') + ': ' + options.shipName]
    : [t('allUnits')];
    
  const startY = await addPDFHeader(
    doc,
    t('title'),
    format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale }),
    rightText,
    { branding }
  );

  // Summary section
  let y = startY + 5;
  doc.setFontSize(12);
  doc.setTextColor(...DARK_GRAY);
  doc.setFont('helvetica', 'bold');
  doc.text(t('summary'), margin, y);
  
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Stats in columns
  const col1 = margin;
  const col2 = margin + 70;
  const col3 = margin + 140;
  const col4 = margin + 210;
  
  doc.text(`${t('totalEquipment')}: ${stats.totalEquipment}`, col1, y);
  doc.text(`${t('active')}: ${stats.activeEquipment}`, col2, y);
  doc.text(`${t('validCertificates')}: ${stats.validCertificates}`, col3, y);
  doc.text(`${t('expiredCertificates')}: ${stats.expiredCertificates}`, col4, y);
  
  y += 5;
  doc.text(`${t('rejected')}: ${stats.rejectedEquipment}`, col1, y);
  doc.text(`${t('inMaintenance')}: ${stats.maintenanceEquipment}`, col2, y);
  doc.text(`${t('expiringSoon')}: ${stats.expiringSoonCertificates}`, col3, y);
  doc.text(`${t('overdueInspections')}: ${stats.overdueInspections}`, col4, y);

  // Equipment table
  y += 12;
  
  const tableData = equipment.map(e => {
    const equipCerts = certificates.filter(c => c.equipment_id === e.id);
    return [
      e.internal_code,
      e.name,
      e.categories?.name || '-',
      e.ship?.name || '-',
      e.status === 'active' ? t('statusActive') : 
        e.status === 'inactive' ? t('statusInactive') :
        e.status === 'maintenance' ? t('statusMaintenance') : t('statusRejected'),
      e.certificate_expiry ? format(parseISO(e.certificate_expiry), 'dd/MM/yyyy') : '-',
      e.next_inspection ? format(parseISO(e.next_inspection), 'dd/MM/yyyy') : '-',
      getComplianceLevel(e, equipCerts),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[
      t('headerCode'),
      t('headerEquipment'),
      t('headerCategory'),
      t('headerShip'),
      t('headerStatus'),
      t('headerCertExpiry'),
      t('headerNextInsp'),
      t('headerCompliance'),
    ]],
    body: tableData,
    headStyles: {
      fillColor: SBM_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: DARK_GRAY,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 38 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { cellWidth: 24 },
      5: { cellWidth: 26 },
      6: { cellWidth: 26 },
      7: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
  });

  // Footer
  const companyName = branding?.name || 'SafeShip';
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

export function exportComplianceReportExcel(
  equipment: EquipmentData[],
  certificates: CertificateData[],
  options?: { shipName?: string }
) {
  const dateLocale = getDateLocale();
  const stats = calculateStats(equipment, certificates);

  // Equipment sheet
  const equipmentData = equipment.map(e => {
    const equipCerts = certificates.filter(c => c.equipment_id === e.id);
    return {
      [t('headerCode')]: e.internal_code,
      [t('headerEquipment')]: e.name,
      [t('headerCategory')]: e.categories?.name || '-',
      [t('headerShip')]: e.ship?.name || '-',
      [t('headerStatus')]: e.status,
      [t('headerLocation')]: e.location || '-',
      [t('headerCertExpiry')]: e.certificate_expiry ? format(parseISO(e.certificate_expiry), 'dd/MM/yyyy') : '-',
      [t('headerNextInsp')]: e.next_inspection ? format(parseISO(e.next_inspection), 'dd/MM/yyyy') : '-',
      [t('headerLastInsp')]: e.last_inspection ? format(parseISO(e.last_inspection), 'dd/MM/yyyy') : '-',
      [t('headerCompliance')]: getComplianceLevel(e, equipCerts),
    };
  });

  const ws = XLSX.utils.json_to_sheet(equipmentData);
  ws['!cols'] = [
    { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('sheetEquipment'));

  // Certificates sheet
  const certData = certificates.map(c => ({
    [t('headerCertName')]: c.name,
    [t('headerEquipment')]: c.equipment?.name || '-',
    [t('headerEquipCode')]: c.equipment?.internal_code || '-',
    [t('headerStatus')]: c.status,
    [t('headerExpiry')]: c.expiry_date ? format(parseISO(c.expiry_date), 'dd/MM/yyyy') : '-',
  }));

  const certWs = XLSX.utils.json_to_sheet(certData);
  certWs['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, certWs, t('sheetCertificates'));

  // Summary sheet
  const summaryData = [
    [t('title')],
    [''],
    [t('generatedAt'), format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale })],
    [t('ship'), options?.shipName || t('allUnits')],
    [''],
    [t('equipmentStats')],
    [t('total'), stats.totalEquipment],
    [t('active'), stats.activeEquipment],
    [t('inactive'), stats.inactiveEquipment],
    [t('inMaintenance'), stats.maintenanceEquipment],
    [t('rejected'), stats.rejectedEquipment],
    [''],
    [t('certificateStats')],
    [t('total'), stats.totalCertificates],
    [t('valid'), stats.validCertificates],
    [t('expiringSoon'), stats.expiringSoonCertificates],
    [t('expired'), stats.expiredCertificates],
    [''],
    [t('inspectionStats')],
    [t('overdue'), stats.overdueInspections],
    [t('upcoming30Days'), stats.upcomingInspections],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, t('sheetSummary'));

  XLSX.writeFile(wb, `${t('fileName')}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
