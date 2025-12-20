import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { EquipmentWithCategory } from '@/hooks/useEquipment';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export function exportToPDF(equipment: EquipmentWithCategory[], filename = 'equipamentos') {
  const doc = new jsPDF('landscape');
  
  doc.setFontSize(18);
  doc.text('Relatório de Equipamentos', 14, 22);
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
  doc.text(`Total de equipamentos: ${equipment.length}`, 14, 36);

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
    startY: 42,
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
    headStyles: { fillColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`${filename}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
