import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardStats } from '@/types/equipment';

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

// SBM Brand Colors
const SBM_ORANGE: [number, number, number] = [243, 111, 39]; // #F36F27
const SBM_BLUE: [number, number, number] = [22, 85, 154]; // #16559A
const DARK_GRAY: [number, number, number] = [51, 51, 51];
const LIGHT_GRAY: [number, number, number] = [245, 247, 250];
const MEDIUM_GRAY: [number, number, number] = [156, 163, 175];
const SUCCESS_GREEN: [number, number, number] = [16, 185, 129];
const WARNING_YELLOW: [number, number, number] = [245, 158, 11];
const DANGER_RED: [number, number, number] = [239, 68, 68];

export function exportDashboardPDF(stats: DashboardStats, filters: ExportFilters) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let yPos = 0;
  
  // === HEADER WITH SBM BRANDING ===
  // Orange accent bar at top
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(0, 0, pageWidth, 4, 'F');
  
  // Blue header section
  doc.setFillColor(...SBM_BLUE);
  doc.rect(0, 4, pageWidth, 28, 'F');
  
  // Company name
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('SBM', 14, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFSHORE', 14, 25);
  
  // Report title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO GERENCIAL DE EQUIPAMENTOS', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedDate}`, pageWidth / 2, 26, { align: 'center' });
  
  // Filters applied
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
  
  if (filtersApplied.length > 0) {
    doc.text(filtersApplied.join(' | '), pageWidth - 14, 18, { align: 'right' });
  }
  
  yPos = 42;
  
  // === KPI SECTION ===
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(14, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(18, yPos, pageWidth - 32, 8, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INDICADORES PRINCIPAIS', 24, yPos + 5.5);
  
  yPos += 14;
  
  // KPI Cards
  const kpiWidth = (pageWidth - 98) / 6;
  const kpis = [
    { label: 'Total Equipamentos', value: stats.totalEquipment.toString(), color: SBM_BLUE },
    { label: 'Ativos', value: stats.activeEquipment.toString(), color: SUCCESS_GREEN },
    { label: 'Cert. Vencidos', value: stats.expiredCertificates.toString(), color: DANGER_RED },
    { label: 'Status Vencido', value: stats.expiredEquipment.toString(), color: DANGER_RED },
    { label: 'Insp. Pendentes', value: stats.pendingInspections.toString(), color: WARNING_YELLOW },
    { label: 'Conformidade', value: `${stats.complianceRate}%`, color: SBM_BLUE },
  ];
  
  kpis.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 5) * index;
    
    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(xPos, yPos, kpiWidth, 28, 3, 3, 'FD');
    
    // Colored accent bar on left
    doc.setFillColor(...kpi.color);
    doc.roundedRect(xPos, yPos, 4, 28, 2, 0, 'F');
    doc.rect(xPos + 2, yPos, 2, 28, 'F');
    
    // Value
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 10, yPos + 14);
    
    // Label
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text(kpi.label, xPos + 10, yPos + 22);
  });
  
  yPos += 38;
  
  // Two columns layout for tables
  const colWidth = (pageWidth - 42) / 2;
  
  // Left column: Status Table
  doc.setFillColor(...SBM_BLUE);
  doc.rect(14, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(18, yPos, colWidth - 4, 8, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DISTRIBUIÇÃO POR STATUS', 24, yPos + 5.5);
  
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
  doc.setFillColor(...SBM_ORANGE);
  doc.rect(14 + colWidth + 14, yPos, 4, 8, 'F');
  doc.setFillColor(...LIGHT_GRAY);
  doc.rect(14 + colWidth + 18, yPos, colWidth - 4, 8, 'F');
  
  doc.setTextColor(...DARK_GRAY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('CONFORMIDADE POR CATEGORIA', 14 + colWidth + 24, yPos + 5.5);
  
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
        fillColor: SBM_ORANGE, 
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
    doc.setFillColor(...DANGER_RED);
    doc.rect(14, yPos, 4, 8, 'F');
    doc.setFillColor(...LIGHT_GRAY);
    doc.rect(18, yPos, pageWidth - 32, 8, 'F');
    
    doc.setTextColor(...DARK_GRAY);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ALERTAS PRIORITÁRIOS', 24, yPos + 5.5);
    
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
  
  // === FOOTER ===
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Footer orange accent
    doc.setFillColor(...SBM_ORANGE);
    doc.rect(0, pageHeight - 10, pageWidth, 2, 'F');
    
    // Footer text
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MEDIUM_GRAY);
    doc.text('SBM Offshore - Sistema de Gestão de Equipamentos de Segurança', 14, pageHeight - 4);
    doc.text(`Relatório Gerencial - ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, pageWidth / 2, pageHeight - 4, { align: 'center' });
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 4, { align: 'right' });
  }
  
  // Save
  const fileName = `SBM_Relatorio_Gerencial_${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
}
