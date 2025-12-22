import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AuditLog } from '@/hooks/useAuditLogs';
import { addPDFHeader, addPDFFooter, SBM_BLUE, DARK_GRAY, MEDIUM_GRAY, preloadLogo } from './pdfStyles';
import type { OrganizationBranding } from '@/hooks/useOrganizationBranding';

const actionLabels: Record<string, string> = {
  INSERT: 'Criação',
  UPDATE: 'Atualização',
  DELETE: 'Exclusão',
};

const tableLabels: Record<string, string> = {
  equipment: 'Equipamento',
  inspections: 'Inspeção',
  categories: 'Categoria',
  ships: 'Embarcação',
  profiles: 'Perfil',
};

export async function exportAuditLogsPDF(
  logs: AuditLog[], 
  filters?: { ship?: string; table?: string; action?: string },
  branding?: OrganizationBranding
) {
  // Preload logo with branding
  await preloadLogo(branding);
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // Build filter info for header
  const filterParts: string[] = [];
  if (filters?.ship) filterParts.push(`Embarcação: ${filters.ship}`);
  if (filters?.table) filterParts.push(`Tipo: ${tableLabels[filters.table] || filters.table}`);
  if (filters?.action) filterParts.push(`Ação: ${actionLabels[filters.action] || filters.action}`);

  const rightText = filterParts.length > 0 ? filterParts : ['Todos os registros'];

  // Add header with branding
  const startY = await addPDFHeader(
    doc,
    'Histórico de Alterações',
    format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }),
    rightText,
    { branding }
  );

  // Stats
  doc.setFontSize(11);
  doc.setTextColor(...DARK_GRAY);
  doc.text(`Total de registros: ${logs.length}`, margin, startY + 5);

  // Table
  const tableData = logs.map(log => [
    format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    tableLabels[log.table_name] || log.table_name,
    actionLabels[log.action] || log.action,
    log.user_name || 'Sistema',
    getChangeSummary(log),
  ]);

  autoTable(doc, {
    startY: startY + 12,
    head: [['Data/Hora', 'Tipo', 'Ação', 'Usuário', 'Resumo']],
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
  addPDFFooter(doc, 'SBM Offshore - Sistema de Gestão', 'Histórico de Alterações');

  doc.save(`historico-alteracoes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}

export function exportAuditLogsExcel(logs: AuditLog[], filters?: { ship?: string; table?: string; action?: string }) {
  const data = logs.map(log => ({
    'Data/Hora': format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
    'Tipo de Registro': tableLabels[log.table_name] || log.table_name,
    'Ação': actionLabels[log.action] || log.action,
    'Usuário': log.user_name || 'Sistema',
    'Resumo': getChangeSummary(log),
    'Campos Alterados': log.changed_fields?.join(', ') || '-',
    'ID do Registro': log.record_id,
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
  XLSX.utils.book_append_sheet(wb, ws, 'Histórico');

  // Add info sheet
  const infoData = [
    ['Relatório de Histórico de Alterações'],
    [''],
    ['Gerado em:', format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })],
    ['Total de registros:', logs.length.toString()],
    [''],
    ['Filtros aplicados:'],
    ['Embarcação:', filters?.ship || 'Todas'],
    ['Tipo:', filters?.table ? (tableLabels[filters.table] || filters.table) : 'Todos'],
    ['Ação:', filters?.action ? (actionLabels[filters.action] || filters.action) : 'Todas'],
  ];

  const infoWs = XLSX.utils.aoa_to_sheet(infoData);
  infoWs['!cols'] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, infoWs, 'Informações');

  XLSX.writeFile(wb, `historico-alteracoes-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

function getChangeSummary(log: AuditLog): string {
  const fieldLabels: Record<string, string> = {
    name: 'Nome',
    internal_code: 'Código Interno',
    status: 'Status',
    category_id: 'Categoria',
    ship_id: 'Embarcação',
    location: 'Localização',
    manufacturer: 'Fabricante',
    model: 'Modelo',
    serial_number: 'Número de Série',
    acquisition_date: 'Data de Aquisição',
    manufacturing_date: 'Data de Fabricação',
    expiry_date: 'Data de Validade',
    certificate_expiry: 'Validade do Certificado',
    next_inspection: 'Próxima Inspeção',
    last_inspection: 'Última Inspeção',
    observations: 'Observações',
    inspection_date: 'Data da Inspeção',
    inspector_id: 'Inspetor',
    recommendations: 'Recomendações',
    actions_taken: 'Ações Tomadas',
    full_name: 'Nome Completo',
    email: 'Email',
    phone: 'Telefone',
    position: 'Cargo',
    department: 'Departamento',
    description: 'Descrição',
    icon: 'Ícone',
    inspection_frequency: 'Frequência de Inspeção',
    code: 'Código',
  };

  if (log.action === 'INSERT') return 'Registro criado';
  if (log.action === 'DELETE') return 'Registro excluído';
  if (log.changed_fields && log.changed_fields.length > 0) {
    const fieldNames = log.changed_fields
      .filter(f => f !== 'updated_at')
      .map(f => fieldLabels[f] || f)
      .slice(0, 3);
    const remaining = log.changed_fields.length - 3;
    return fieldNames.join(', ') + (remaining > 0 ? ` e mais ${remaining}` : '');
  }
  return 'Alterações realizadas';
}
