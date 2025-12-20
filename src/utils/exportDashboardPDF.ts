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

export function exportDashboardPDF(stats: DashboardStats, filters: ExportFilters) {
  // Create PDF in landscape orientation
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138];
  const successColor: [number, number, number] = [34, 197, 94];
  const warningColor: [number, number, number] = [245, 158, 11];
  const dangerColor: [number, number, number] = [239, 68, 68];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Gerencial - Dashboard de Equipamentos', 14, 18);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedDate}`, 14, 28);
  
  // Filters applied
  const filtersApplied: string[] = [];
  if (filters.shipName && filters.shipName !== 'all') {
    filtersApplied.push(`Navio: ${filters.shipName}`);
  }
  if (filters.categoryName && filters.categoryName !== 'all') {
    filtersApplied.push(`Categoria: ${filters.categoryName}`);
  }
  if (filters.startDate && filters.endDate) {
    filtersApplied.push(`Período: ${format(filters.startDate, 'dd/MM/yyyy')} - ${format(filters.endDate, 'dd/MM/yyyy')}`);
  }
  
  if (filtersApplied.length > 0) {
    doc.text(`Filtros: ${filtersApplied.join(' | ')}`, pageWidth - 14, 28, { align: 'right' });
  }
  
  yPos = 45;
  
  // KPI Section Title
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Indicadores Principais', 14, yPos);
  yPos += 8;
  
  // KPI Cards - Using more horizontal space in landscape
  const kpiWidth = (pageWidth - 70) / 5;
  const kpis = [
    { label: 'Total Equipamentos', value: stats.totalEquipment.toString(), color: primaryColor },
    { label: 'Ativos', value: stats.activeEquipment.toString(), color: successColor },
    { label: 'Vencidos/Reprovados', value: stats.expiredEquipment.toString(), color: dangerColor },
    { label: 'Inspeções Pendentes', value: stats.pendingInspections.toString(), color: warningColor },
    { label: 'Taxa Conformidade', value: `${stats.complianceRate}%`, color: primaryColor },
  ];
  
  kpis.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 5) * index;
    
    // Card background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(xPos, yPos, kpiWidth, 25, 3, 3, 'F');
    
    // Accent bar
    doc.setFillColor(...kpi.color);
    doc.rect(xPos, yPos, 3, 25, 'F');
    
    // Value
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 8, yPos + 12);
    
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, xPos + 8, yPos + 20);
  });
  
  yPos += 35;
  
  // Two columns layout for tables
  const colWidth = (pageWidth - 42) / 2;
  
  // Left column: Status Table
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuição por Status', 14, yPos);
  
  const statusData = stats.byStatus
    .filter(s => s.count > 0)
    .map(s => [
      statusLabels[s.status] || s.status,
      s.count.toString(),
      `${stats.totalEquipment > 0 ? ((s.count / stats.totalEquipment) * 100).toFixed(1) : 0}%`
    ]);
  
  autoTable(doc, {
    startY: yPos + 4,
    head: [['Status', 'Qtd', '%']],
    body: statusData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 9, cellPadding: 3 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 14, right: pageWidth - 14 - colWidth },
    tableWidth: colWidth,
  });
  
  // Right column: Category Table
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Conformidade por Categoria', 14 + colWidth + 14, yPos);
  
  if (stats.byCategory.length > 0) {
    const categoryData = stats.byCategory.map(c => [
      c.category.length > 20 ? c.category.substring(0, 18) + '...' : c.category,
      c.count.toString(),
      c.compliant.toString(),
      c.nonCompliant.toString(),
      `${c.count > 0 ? ((c.compliant / c.count) * 100).toFixed(0) : 0}%`
    ]);
    
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Categoria', 'Total', 'OK', 'NC', '%']],
      body: categoryData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontSize: 9, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
      },
      margin: { left: 14 + colWidth + 14, right: 14 },
      tableWidth: colWidth,
    });
  }
  
  // Get the Y position after both tables
  const statusTableEndY = (doc as any).lastAutoTable?.finalY || yPos + 50;
  yPos = statusTableEndY + 15;
  
  // Alerts Section - Full width
  if (stats.recentAlerts.length > 0 && yPos < pageHeight - 50) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertas Prioritários', 14, yPos);
    
    const alertData = stats.recentAlerts.slice(0, 8).map(a => [
      a.message,
      a.equipmentName.length > 35 ? a.equipmentName.substring(0, 33) + '...' : a.equipmentName,
      a.date,
      a.severity === 'high' ? 'Alta' : a.severity === 'medium' ? 'Média' : 'Baixa'
    ]);
    
    autoTable(doc, {
      startY: yPos + 4,
      head: [['Alerta', 'Equipamento', 'Data', 'Prioridade']],
      body: alertData,
      theme: 'striped',
      headStyles: { fillColor: dangerColor, fontSize: 9, cellPadding: 3 },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 100 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
  }
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `SafeShip - Sistema de Gestão de Equipamentos | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }
  
  // Save
  const fileName = `dashboard-gerencial-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
}
