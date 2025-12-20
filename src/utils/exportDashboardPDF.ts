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
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Colors
  const primaryColor: [number, number, number] = [30, 58, 138];
  const successColor: [number, number, number] = [34, 197, 94];
  const warningColor: [number, number, number] = [245, 158, 11];
  const dangerColor: [number, number, number] = [239, 68, 68];
  
  let yPos = 20;
  
  // Header
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório Gerencial', 14, 22);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Dashboard de Equipamentos', 14, 32);
  
  // Date and filters info
  doc.setFontSize(10);
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${generatedDate}`, pageWidth - 14, 22, { align: 'right' });
  
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
    doc.text(filtersApplied.join(' | '), pageWidth - 14, 32, { align: 'right' });
  }
  
  yPos = 55;
  
  // KPI Section
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Indicadores Principais', 14, yPos);
  yPos += 10;
  
  // KPI Cards
  const kpiWidth = (pageWidth - 42) / 4;
  const kpis = [
    { label: 'Total Equipamentos', value: stats.totalEquipment.toString(), color: primaryColor },
    { label: 'Ativos', value: stats.activeEquipment.toString(), color: successColor },
    { label: 'Vencidos/Reprovados', value: stats.expiredEquipment.toString(), color: dangerColor },
    { label: 'Inspeções Pendentes', value: stats.pendingInspections.toString(), color: warningColor },
  ];
  
  kpis.forEach((kpi, index) => {
    const xPos = 14 + (kpiWidth + 5) * index;
    
    // Card background
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(xPos, yPos, kpiWidth, 28, 3, 3, 'F');
    
    // Accent bar
    doc.setFillColor(...kpi.color);
    doc.rect(xPos, yPos, 3, 28, 'F');
    
    // Value
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...kpi.color);
    doc.text(kpi.value, xPos + 8, yPos + 14);
    
    // Label
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, xPos + 8, yPos + 22);
  });
  
  yPos += 40;
  
  // Compliance Rate
  doc.setFillColor(...primaryColor);
  doc.roundedRect(14, yPos, pageWidth - 28, 25, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Taxa de Conformidade Geral', 20, yPos + 10);
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(`${stats.complianceRate}%`, 20, yPos + 20);
  
  // Progress bar
  const progressWidth = 80;
  const progressHeight = 6;
  const progressX = pageWidth - 28 - progressWidth;
  const progressY = yPos + 12;
  
  doc.setFillColor(255, 255, 255);
  doc.setGState(new (doc as any).GState({ opacity: 0.3 }));
  doc.roundedRect(progressX, progressY, progressWidth, progressHeight, 2, 2, 'F');
  
  doc.setGState(new (doc as any).GState({ opacity: 1 }));
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(progressX, progressY, progressWidth * (stats.complianceRate / 100), progressHeight, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.text('Meta: 95%', progressX + progressWidth + 5, progressY + 5);
  
  yPos += 35;
  
  // Status Table
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Distribuição por Status', 14, yPos);
  yPos += 5;
  
  const statusData = stats.byStatus
    .filter(s => s.count > 0)
    .map(s => [
      statusLabels[s.status] || s.status,
      s.count.toString(),
      `${stats.totalEquipment > 0 ? ((s.count / stats.totalEquipment) * 100).toFixed(1) : 0}%`
    ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['Status', 'Quantidade', 'Percentual']],
    body: statusData,
    theme: 'striped',
    headStyles: { fillColor: primaryColor, fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 60 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 40, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 15;
  
  // Category Table
  if (stats.byCategory.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Conformidade por Categoria', 14, yPos);
    yPos += 5;
    
    const categoryData = stats.byCategory.map(c => [
      c.category,
      c.count.toString(),
      c.compliant.toString(),
      c.nonCompliant.toString(),
      `${c.count > 0 ? ((c.compliant / c.count) * 100).toFixed(1) : 0}%`
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', 'Total', 'Conforme', 'Não Conforme', '% Conform.']],
      body: categoryData,
      theme: 'striped',
      headStyles: { fillColor: primaryColor, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }
  
  // Alerts Section (if space allows)
  if (yPos < 220 && stats.recentAlerts.length > 0) {
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertas Prioritários', 14, yPos);
    yPos += 5;
    
    const alertData = stats.recentAlerts.slice(0, 5).map(a => [
      a.message,
      a.equipmentName,
      a.severity === 'high' ? 'Alta' : a.severity === 'medium' ? 'Média' : 'Baixa'
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['Alerta', 'Equipamento', 'Prioridade']],
      body: alertData,
      theme: 'striped',
      headStyles: { fillColor: dangerColor, fontSize: 10 },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 70 },
        2: { cellWidth: 30, halign: 'center' },
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
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  // Save
  const fileName = `dashboard-gerencial-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(fileName);
}
