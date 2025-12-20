import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface ExportFilters {
  shipName?: string;
  categoryName?: string;
  startDate?: Date;
  endDate?: Date;
}

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  expired: 'Vencido',
  rejected: 'Reprovado',
  inactive: 'Inativo',
};

export async function exportDashboardPDF(stats: DashboardStats, filters: ExportFilters) {
  // Preload logo before generating PDF
  await preloadLogo();
  
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Build filters text
  const filtersApplied: string[] = [];
  if (filters.shipName && filters.shipName !== 'all') {
    filtersApplied.push(`Unidade: ${filters.shipName}`);
  }
  if (filters.categoryName && filters.categoryName !== 'all') {
    filtersApplied.push(`Categoria: ${filters.categoryName}`);
  }
  if (filters.startDate && filters.endDate) {
    filtersApplied.push(`Período: ${format(filters.startDate, 'dd/MM/yyyy')} - ${format(filters.endDate, 'dd/MM/yyyy')}`);
  }
  
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO GERENCIAL DE EQUIPAMENTOS',
    `Gerado em: ${generatedDate}`,
    filtersApplied.length > 0 ? [filtersApplied.join(' | ')] : undefined
  );
  
  // === KPI SECTION ===
  yPos = addSectionHeader(doc, yPos, 'INDICADORES PRINCIPAIS', SBM_BLUE, pageWidth - 28);
  yPos += 4;
  
  // KPI Cards - 2 rows
  const kpiWidth = (pageWidth - 70) / 5;
  const kpis = [
    { label: 'Total Equipamentos', value: stats.totalEquipment.toString(), color: SBM_BLUE },
    { label: 'Ativos', value: stats.activeEquipment.toString(), color: SUCCESS_GREEN },
    { label: 'Cert. Vencidos', value: stats.expiredCertificates.toString(), color: DANGER_RED },
    { label: 'Status Vencido', value: stats.expiredEquipment.toString(), color: DANGER_RED },
    { label: 'Insp. Pendentes', value: stats.pendingInspections.toString(), color: WARNING_YELLOW },
  ];
  
  const kpisRow2 = [
    { label: 'Conformidade', value: `${stats.complianceRate}%`, color: SBM_BLUE },
    { label: 'Manut. Pendentes', value: stats.pendingMaintenance.toString(), color: WARNING_YELLOW },
    { label: 'Manut. Atrasadas', value: stats.overdueMaintenance.toString(), color: DANGER_RED },
    { label: 'Manut. em Exec.', value: stats.inProgressMaintenance.toString(), color: SBM_BLUE },
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
  addSectionHeader(doc, yPos, 'DISTRIBUIÇÃO POR STATUS', SBM_BLUE, colWidth);
  
  const statusData = stats.byStatus
    .filter(s => s.count > 0)
    .map(s => [
      statusLabels[s.status] || s.status,
      s.count.toString(),
      `${stats.totalEquipment > 0 ? ((s.count / stats.totalEquipment) * 100).toFixed(1) : 0}%`
    ]);
  
  autoTable(doc, {
    startY: yPos + 10,
    head: [['Status', 'Quantidade', 'Percentual']],
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
  addSectionHeader(doc, yPos, 'CONFORMIDADE POR CATEGORIA', SBM_BLUE, colWidth);
  
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
      head: [['Categoria', 'Total', 'Conforme', 'N/C', 'Taxa']],
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
    addSectionHeader(doc, yPos, 'ALERTAS PRIORITÁRIOS', DANGER_RED, pageWidth - 28);
    
    const alertData = stats.recentAlerts.slice(0, 8).map(a => {
      const severityLabel = a.severity === 'high' ? 'Alta' : a.severity === 'medium' ? 'Média' : 'Baixa';
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
      head: [['Descrição do Alerta', 'Equipamento', 'Data', 'Prioridade']],
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
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório Gerencial - ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
  );
  
  // Save
  const fileName = `SBM_Relatorio_Gerencial_${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
}