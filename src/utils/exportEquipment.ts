import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  expired: 'Vencido',
  rejected: 'Reprovado',
  inactive: 'Inativo',
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
};

export function exportToExcel(equipment: EquipmentWithCategory[], filename = 'equipamentos') {
  const data = equipment.map(item => ({
    'Código Interno': item.internal_code,
    'Nome': item.name,
    'Categoria': item.categories?.name || '—',
    'Tipo': item.type,
    'Fabricante': item.manufacturer,
    'Modelo': item.model,
    'Nº Série': item.serial_number,
    'Capacidade': item.capacity || '—',
    'Unidade': item.unit,
    'Localização': item.location,
    'Status': statusLabels[item.status] || item.status,
    'Data Fabricação': formatDate(item.manufacturing_date),
    'Data Aquisição': formatDate(item.acquisition_date),
    'Validade': formatDate(item.expiry_date),
    'Validade Certificado': formatDate(item.certificate_expiry),
    'Última Inspeção': formatDate(item.last_inspection),
    'Próxima Inspeção': formatDate(item.next_inspection),
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
  
  // Auto-size columns
  const maxWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || '').length))
  }));
  ws['!cols'] = maxWidths;

  XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export async function exportToPDF(equipment: EquipmentWithCategory[], filename = 'equipamentos') {
  // Preload logo
  await preloadLogo();
  
  const doc = new jsPDF('landscape');
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedDate = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  
  // Add standardized header with logo
  let yPos = await addPDFHeader(
    doc,
    'RELATÓRIO DE EQUIPAMENTOS',
    `Gerado em: ${generatedDate}`,
    [`Total: ${equipment.length} equipamentos`]
  );

  const tableData = equipment.map(item => [
    item.internal_code,
    item.name,
    item.categories?.name || '—',
    item.capacity || '—',
    item.location,
    statusLabels[item.status] || item.status,
    formatDate(item.last_inspection),
    formatDate(item.next_inspection),
    formatDate(item.certificate_expiry),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [[
      'Código',
      'Nome',
      'Categoria',
      'Capacidade',
      'Localização',
      'Status',
      'Última Insp.',
      'Próx. Insp.',
      'Val. Cert.'
    ]],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: SBM_BLUE },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Add standardized footer
  addPDFFooter(
    doc,
    'SBM Offshore - Sistema de Gestão de Equipamentos de Segurança',
    `Relatório de Equipamentos - ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  );

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
