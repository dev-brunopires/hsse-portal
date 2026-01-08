import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import type { DashboardStats } from '@/types/equipment';
import {
  SBM_BLUE,
  DARK_GRAY,
  LIGHT_GRAY,
  MEDIUM_GRAY,
  SUCCESS_GREEN,
  WARNING_YELLOW,
  DANGER_RED,
  addPDFHeader,
  addPDFFooter,
  addSectionHeader,
  preloadLogo,
} from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';
import i18n from '@/i18n';

const getDateLocale = () => i18n.language === 'en' ? enUS : ptBR;

interface ExportFilters {
  shipName?: string;
  categoryName?: string;
  startDate?: Date;
  endDate?: Date;
  branding?: OrganizationBranding;
}

const getStatusLabels = (): Record<string, string> => ({
  active: i18n.t('exportDashboardPDF.statusActive'),
  maintenance: i18n.t('exportDashboardPDF.statusMaintenance'),
  expired: i18n.t('exportDashboardPDF.statusExpired'),
  rejected: i18n.t('exportDashboardPDF.statusRejected'),
  inactive: i18n.t('exportDashboardPDF.statusInactive'),
});

export async function exportDashboardPDF(stats: DashboardStats, filters: ExportFilters, options?: { preview?: boolean }) {
  const t = i18n.t;
  const dateLocale = getDateLocale();
  const statusLabels = getStatusLabels();
  
  // Preload logo before generating PDF with branding
  await preloadLogo(filters.branding);
  
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Build filters text
  const filtersApplied: string[] = [];
  if (filters.shipName && filters.shipName !== 'all') {
    filtersApplied.push(`${t('exportDashboardPDF.filterUnit')}: ${filters.shipName}`);
  }
  if (filters.categoryName && filters.categoryName !== 'all') {
    filtersApplied.push(`${t('exportDashboardPDF.filterCategory')}: ${filters.categoryName}`);
  }
  if (filters.startDate && filters.endDate) {
    filtersApplied.push(`${t('exportDashboardPDF.filterPeriod')}: ${format(filters.startDate, 'dd/MM/yyyy')} - ${format(filters.endDate, 'dd/MM/yyyy')}`);
  }
  
  const generatedDate = format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale });
  
  // Add standardized header with branding
  let yPos = await addPDFHeader(
    doc,
    t('exportDashboardPDF.reportTitle'),
    `${t('exportDashboardPDF.generatedAt')}: ${generatedDate}`,
    filtersApplied.length > 0 ? [filtersApplied.join(' | ')] : undefined,
    { branding: filters.branding }
  );
  
  // === KPI SECTION ===
  yPos = addSectionHeader(doc, yPos, t('exportDashboardPDF.mainIndicators'), SBM_BLUE, pageWidth - 28);
  yPos += 4;
  
  // KPI Cards - 2 rows
  const kpiWidth = (pageWidth - 70) / 5;
  const kpis = [
    { label: t('exportDashboardPDF.totalEquipment'), value: stats.totalEquipment.toString(), color: SBM_BLUE },
    { label: t('exportDashboardPDF.activeEquipment'), value: stats.activeEquipment.toString(), color: SUCCESS_GREEN },
    { label: t('exportDashboardPDF.expiredCertificates'), value: stats.expiredCertificates.toString(), color: DANGER_RED },
    { label: t('exportDashboardPDF.expiredStatus'), value: stats.expiredEquipment.toString(), color: DANGER_RED },
    { label: t('exportDashboardPDF.pendingInspections'), value: stats.pendingInspections.toString(), color: WARNING_YELLOW },
  ];
  
  const kpisRow2 = [
    { label: t('exportDashboardPDF.compliance'), value: `${stats.complianceRate}%`, color: SBM_BLUE },
    { label: t('exportDashboardPDF.pendingMaintenance'), value: stats.pendingMaintenance.toString(), color: WARNING_YELLOW },
    { label: t('exportDashboardPDF.overdueMaintenance'), value: stats.overdueMaintenance.toString(), color: DANGER_RED },
    { label: t('exportDashboardPDF.inProgressMaintenance'), value: stats.inProgressMaintenance.toString(), color: SBM_BLUE },
  ];
  
  kpis.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 4) * index;
    
    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(xPos, yPos, kpiWidth, 26, 3, 3, 'FD');
    
    // Colored accent bar on left
    doc.setFillColor(...kpi.color);
    doc.roundedRect(xPos, yPos, 4, 26, 2, 0, 'F');
    doc.rect(xPos + 2, yPos, 2, 26, 'F');
    
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 10, yPos + 12);
    
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(kpi.label, xPos + 10, yPos + 20);
  });
  
  yPos += 30;
  
  // Row 2 of KPIs
  kpisRow2.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 4) * index;
    
    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(xPos, yPos, kpiWidth, 26, 3, 3, 'FD');
    
    // Colored accent bar on left
    doc.setFillColor(...kpi.color);
    doc.roundedRect(xPos, yPos, 4, 26, 2, 0, 'F');
    doc.rect(xPos + 2, yPos, 2, 26, 'F');
    
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 10, yPos + 12);
    
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(kpi.label, xPos + 10, yPos + 20);
  });
  
  yPos += 34;
  
  // Two columns layout for tables
  const colWidth = (pageWidth - 42) / 2;
  
  // Left column: Status Table
  addSectionHeader(doc, yPos, t('exportDashboardPDF.statusDistribution'), SBM_BLUE, colWidth);
  
  const statusData = stats.byStatus
    .filter(s => s.count > 0)
    .map(s => [
      statusLabels[s.status] || s.status,
      s.count.toString(),
      `${stats.totalEquipment > 0 ? ((s.count / stats.totalEquipment) * 100).toFixed(1) : 0}%`
    ]);
  
  autoTable(doc, {
    startY: yPos + 10,
    head: [[t('exportDashboardPDF.tableStatus'), t('exportDashboardPDF.tableQuantity'), t('exportDashboardPDF.tablePercentage')]],
    body: statusData,
    theme: 'striped',
    headStyles: { 
      fillColor: SBM_BLUE, 
      fontSize: 9, 
      cellPadding: 3,
      textColor: [255, 255, 255]
    },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30, halign: 'center' },
      2: { cellWidth: 30, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    margin: { left: 14, right: pageWidth - 14 - colWidth },
    tableWidth: colWidth,
  });
  
  // Right column: Category Table
  addSectionHeader(doc, yPos, t('exportDashboardPDF.categoryCompliance'), SBM_BLUE, colWidth);
  
  if (stats.byCategory.length > 0) {
    const categoryData = stats.byCategory.map(c => [
      c.category.length > 20 ? c.category.substring(0, 18) + '...' : c.category,
      c.count.toString(),
      c.compliant.toString(),
      c.nonCompliant.toString(),
      `${c.count > 0 ? ((c.compliant / c.count) * 100).toFixed(0) : 0}%`
    ]);
    
    autoTable(doc, {
      startY: yPos + 10,
      head: [[t('exportDashboardPDF.tableCategory'), t('exportDashboardPDF.tableTotal'), t('exportDashboardPDF.tableCompliant'), t('exportDashboardPDF.tableNC'), t('exportDashboardPDF.tableRate')]],
      body: categoryData,
      theme: 'striped',
      headStyles: { 
        fillColor: SBM_BLUE, 
        fontSize: 9, 
        cellPadding: 3,
        textColor: [255, 255, 255]
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14 + colWidth + 14, right: 14 },
      tableWidth: colWidth,
    });
  }
  
  // Get the Y position after both tables
  const statusTableEndY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  yPos = statusTableEndY + 12;
  
  // Alerts Section - Full width
  if (stats.recentAlerts.length > 0 && yPos < pageHeight - 50) {
    addSectionHeader(doc, yPos, t('exportDashboardPDF.priorityAlerts'), DANGER_RED, pageWidth - 28);
    
    const alertData = stats.recentAlerts.slice(0, 8).map(a => {
      const severityLabel = a.severity === 'high' ? t('exportDashboardPDF.severityHigh') : a.severity === 'medium' ? t('exportDashboardPDF.severityMedium') : t('exportDashboardPDF.severityLow');
      const severityColor: [number, number, number] = a.severity === 'high' 
        ? DANGER_RED 
        : a.severity === 'medium' 
          ? WARNING_YELLOW 
          : MEDIUM_GRAY;
      
      return [
        a.message,
        a.equipmentName.length > 40 ? a.equipmentName.substring(0, 38) + '...' : a.equipmentName,
        a.date,
        { content: severityLabel, styles: { textColor: severityColor, fontStyle: 'bold' as const } }
      ];
    });
    
    autoTable(doc, {
      startY: yPos + 10,
      head: [[t('exportDashboardPDF.alertDescription'), t('exportDashboardPDF.alertEquipment'), t('exportDashboardPDF.alertDate'), t('exportDashboardPDF.alertPriority')]],
      body: alertData,
      theme: 'striped',
      headStyles: { 
        fillColor: DANGER_RED, 
        fontSize: 9, 
        cellPadding: 3,
        textColor: [255, 255, 255]
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 90 },
        1: { cellWidth: 100 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
      alternateRowStyles: { fillColor: [250, 251, 252] },
      margin: { left: 14, right: 14 },
    });
  }
  
  // Add standardized footer
  addPDFFooter(
    doc,
    filters.branding?.name || t('exportDashboardPDF.footerCompany'),
    `${t('exportDashboardPDF.reportTitle')} - ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: dateLocale })}`
  );
  
  // Preview or Save
  const fileName = `${t('exportDashboardPDF.filePrefix')}_${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  
  if (options?.preview) {
    // Open PDF in new tab for preview
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  } else {
    doc.save(fileName);
  }
}