import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { addPDFHeader, addPDFFooter, addSignatureSection, preloadLogo } from './pdfStyles';
import type { MaintenanceRequestWithDetails } from '@/hooks/useMaintenanceRequests';
import i18n from '@/i18n';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

function getDateLocale() {
  return i18n.language === 'pt-BR' ? ptBR : enUS;
}

function getLabels() {
  const t = i18n.t.bind(i18n);
  
  return {
    status: {
      pending: t('maintenance.statusPending'),
      approved: t('maintenance.statusApproved'),
      in_progress: t('maintenance.statusInProgress'),
      completed: t('maintenance.statusCompleted'),
      rejected: t('maintenance.statusRejected'),
    } as Record<string, string>,
    type: {
      preventive: t('maintenance.typePreventive'),
      corrective: t('maintenance.typeCorrective'),
    } as Record<string, string>,
    priority: {
      low: t('maintenance.priorityLow'),
      medium: t('maintenance.priorityMedium'),
      high: t('maintenance.priorityHigh'),
      critical: t('maintenance.priorityCritical'),
    } as Record<string, string>,
  };
}

export async function exportMaintenanceToPDF(
  data: MaintenanceRequestWithDetails[],
  fileName: string = 'manutencoes',
  branding?: OrganizationBranding,
  options?: { preview?: boolean }
): Promise<void> {
  const t = i18n.t.bind(i18n);
  const dateLocale = getDateLocale();
  const labels = getLabels();

  await preloadLogo(branding);
  
  const doc = new jsPDF('landscape');
  
  // Stats
  const pending = data.filter(m => m.status === 'pending').length;
  const inProgress = data.filter(m => m.status === 'in_progress').length;
  const completed = data.filter(m => m.status === 'completed').length;
  
  const startY = await addPDFHeader(
    doc,
    t('exportMaintenance.title'),
    `${t('exportMaintenance.total')}: ${data.length} | ${t('exportMaintenance.pending')}: ${pending} | ${t('exportMaintenance.inProgress')}: ${inProgress} | ${t('exportMaintenance.completed')}: ${completed}`,
    undefined,
    { branding }
  );

  const tableData = data.map(item => [
    format(new Date(item.created_at), 'dd/MM/yyyy', { locale: dateLocale }),
    item.title?.substring(0, 30) + (item.title && item.title.length > 30 ? '...' : '') || '—',
    item.equipment?.name || '—',
    item.equipment?.internal_code || '—',
    labels.type[item.type] || item.type,
    labels.priority[item.priority] || item.priority,
    labels.status[item.status] || item.status,
    item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
    item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
  ]);

  autoTable(doc, {
    startY: startY,
    head: [[
      t('exportMaintenance.date'),
      t('exportMaintenance.titleColumn'),
      t('exportMaintenance.equipment'),
      t('exportMaintenance.code'),
      t('exportMaintenance.type'),
      t('exportMaintenance.priority'),
      t('exportMaintenance.status'),
      t('exportMaintenance.dueDate'),
      t('exportMaintenance.completedDate'),
    ]],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [22, 85, 154], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24 }, // Date
      1: { cellWidth: 'auto' }, // Title
      2: { cellWidth: 38 }, // Equipment
      3: { cellWidth: 24 }, // Code
      4: { cellWidth: 24 }, // Type
      5: { cellWidth: 22 }, // Priority
      6: { cellWidth: 24 }, // Status
      7: { cellWidth: 24 }, // Due Date
      8: { cellWidth: 26 }, // Completed Date
    },
  });

  const companyName = branding?.name || 'HSSE Connect';
  addPDFFooter(doc, t('exportMaintenance.footerTitle', { companyName }), t('exportMaintenance.footerSubtitle'));
  
  if (options?.preview) {
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    window.open(url, '_blank');
  } else {
    doc.save(`${fileName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }
}

export function exportMaintenanceToExcel(
  data: MaintenanceRequestWithDetails[],
  fileName: string = 'manutencoes'
): void {
  const t = i18n.t.bind(i18n);
  const dateLocale = getDateLocale();
  const labels = getLabels();

  const excelData = data.map(item => ({
    [t('exportMaintenance.date')]: format(new Date(item.created_at), 'dd/MM/yyyy', { locale: dateLocale }),
    [t('exportMaintenance.titleColumn')]: item.title || '—',
    [t('exportMaintenance.equipment')]: item.equipment?.name || '—',
    [t('exportMaintenance.code')]: item.equipment?.internal_code || '—',
    [t('exportMaintenance.type')]: labels.type[item.type] || item.type,
    [t('exportMaintenance.priority')]: labels.priority[item.priority] || item.priority,
    [t('exportMaintenance.status')]: labels.status[item.status] || item.status,
    [t('exportMaintenance.dueDate')]: item.due_date ? format(new Date(item.due_date), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
    [t('exportMaintenance.completedDate')]: item.completed_at ? format(new Date(item.completed_at), 'dd/MM/yyyy', { locale: dateLocale }) : '—',
    [t('exportMaintenance.description')]: item.description || '—',
    [t('exportMaintenance.workPerformed')]: item.work_performed || '—',
    [t('exportMaintenance.requester')]: item.requester?.full_name || '—',
  }));

  const ws = XLSX.utils.json_to_sheet(excelData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t('exportMaintenance.sheetName'));
  XLSX.writeFile(wb, `${fileName}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
