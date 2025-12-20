import { useState, useMemo } from 'react';
import { FileText, Download, Calendar, Filter, AlertTriangle, Ship, Loader2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useEquipment } from '@/hooks/useEquipment';
import { useInspections } from '@/hooks/useInspections';
import { useCategories } from '@/hooks/useCategories';
import { useShips } from '@/hooks/useShips';
import { exportToExcel, exportToPDF } from '@/utils/exportEquipment';
import { exportInspectionsToExcel, exportInspectionsToPDF } from '@/utils/exportInspections';
import { toast } from 'sonner';
import { format, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const statusLabels: Record<string, string> = {
  active: 'Ativo',
  maintenance: 'Em Manutenção',
  expired: 'Vencido',
  rejected: 'Reprovado',
  inactive: 'Inativo',
};

export default function Reports() {
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: inspections = [], isLoading: inspectionsLoading } = useInspections();
  const { data: categories = [] } = useCategories();
  const { data: ships = [] } = useShips();

  // Filters
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [startDateStr, setStartDateStr] = useState<string>('');
  const [endDateStr, setEndDateStr] = useState<string>('');

  const isLoading = equipmentLoading || inspectionsLoading;

  // Filtered data based on global filters
  const filteredEquipment = useMemo(() => {
    return equipment.filter(item => {
      if (shipFilter !== 'all' && item.ship_id !== shipFilter) return false;
      if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false;
      return true;
    });
  }, [equipment, shipFilter, categoryFilter]);

  const filteredInspections = useMemo(() => {
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    return inspections.filter(item => {
      const equipmentItem = equipment.find(e => e.id === item.equipment_id);
      if (shipFilter !== 'all' && equipmentItem?.ship_id !== shipFilter) return false;
      if (categoryFilter !== 'all' && equipmentItem?.category_id !== categoryFilter) return false;
      if (startDate && isBefore(new Date(item.inspection_date), startOfDay(startDate))) return false;
      if (endDate && isAfter(new Date(item.inspection_date), startOfDay(addDays(endDate, 1)))) return false;
      return true;
    });
  }, [inspections, equipment, shipFilter, categoryFilter, startDateStr, endDateStr]);
  

  // Report 1: Inspection Report
  const handleInspectionReportPDF = () => {
    if (filteredInspections.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }
    exportInspectionsToPDF(filteredInspections, 'relatorio_inspecoes');
    toast.success('Relatório de inspeções exportado em PDF');
  };

  const handleInspectionReportExcel = () => {
    if (filteredInspections.length === 0) {
      toast.error('Nenhuma inspeção encontrada para exportar');
      return;
    }
    exportInspectionsToExcel(filteredInspections, 'relatorio_inspecoes');
    toast.success('Relatório de inspeções exportado em Excel');
  };

  // Report 2: Category Report
  const handleCategoryReportPDF = () => {
    if (filteredEquipment.length === 0) {
      toast.error('Nenhum equipamento encontrado para exportar');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Relatório por Categoria', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);

    // Group by category
    const groupedByCategory = categories.map(cat => {
      const catEquipment = filteredEquipment.filter(e => e.category_id === cat.id);
      const active = catEquipment.filter(e => e.status === 'active').length;
      const maintenance = catEquipment.filter(e => e.status === 'maintenance').length;
      const expired = catEquipment.filter(e => e.status === 'expired').length;
      const rejected = catEquipment.filter(e => e.status === 'rejected').length;
      const compliance = catEquipment.length > 0 
        ? Math.round((active / catEquipment.length) * 100) 
        : 0;
      
      return [
        cat.name,
        catEquipment.length.toString(),
        active.toString(),
        maintenance.toString(),
        expired.toString(),
        rejected.toString(),
        `${compliance}%`
      ];
    }).filter(row => parseInt(row[1]) > 0);

    autoTable(doc, {
      startY: 38,
      head: [['Categoria', 'Total', 'Ativos', 'Manutenção', 'Vencidos', 'Reprovados', 'Conformidade']],
      body: groupedByCategory,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`relatorio_categorias_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório por categoria exportado em PDF');
  };

  const handleCategoryReportExcel = () => {
    if (filteredEquipment.length === 0) {
      toast.error('Nenhum equipamento encontrado para exportar');
      return;
    }

    const data = categories.map(cat => {
      const catEquipment = filteredEquipment.filter(e => e.category_id === cat.id);
      const active = catEquipment.filter(e => e.status === 'active').length;
      const maintenance = catEquipment.filter(e => e.status === 'maintenance').length;
      const expired = catEquipment.filter(e => e.status === 'expired').length;
      const rejected = catEquipment.filter(e => e.status === 'rejected').length;
      const compliance = catEquipment.length > 0 
        ? Math.round((active / catEquipment.length) * 100) 
        : 0;

      return {
        'Categoria': cat.name,
        'Total Equipamentos': catEquipment.length,
        'Ativos': active,
        'Em Manutenção': maintenance,
        'Vencidos': expired,
        'Reprovados': rejected,
        'Conformidade (%)': compliance,
      };
    }).filter(row => row['Total Equipamentos'] > 0);

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Categorias');
    XLSX.writeFile(wb, `relatorio_categorias_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório por categoria exportado em Excel');
  };

  // Report 3: Expiry Report
  const expiringEquipment = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);
    
    return filteredEquipment.filter(item => {
      if (!item.certificate_expiry) return false;
      const expiryDate = new Date(item.certificate_expiry);
      return isBefore(expiryDate, thirtyDaysFromNow);
    }).sort((a, b) => {
      const dateA = new Date(a.certificate_expiry!);
      const dateB = new Date(b.certificate_expiry!);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredEquipment]);

  const handleExpiryReportPDF = () => {
    if (expiringEquipment.length === 0) {
      toast.error('Nenhum equipamento com certificado próximo do vencimento');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Relatório de Vencimentos', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
    doc.text(`Equipamentos com certificados vencendo nos próximos 30 dias: ${expiringEquipment.length}`, 14, 36);

    const tableData = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const status = daysUntilExpiry < 0 ? 'VENCIDO' : `${daysUntilExpiry} dias`;

      return [
        item.internal_code,
        item.name,
        item.categories?.name || '—',
        item.location,
        format(expiryDate, 'dd/MM/yyyy', { locale: ptBR }),
        status,
      ];
    });

    autoTable(doc, {
      startY: 44,
      head: [['Código', 'Equipamento', 'Categoria', 'Localização', 'Vencimento', 'Status']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [220, 38, 38] },
      alternateRowStyles: { fillColor: [254, 242, 242] },
    });

    doc.save(`relatorio_vencimentos_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório de vencimentos exportado em PDF');
  };

  const handleExpiryReportExcel = () => {
    if (expiringEquipment.length === 0) {
      toast.error('Nenhum equipamento com certificado próximo do vencimento');
      return;
    }

    const data = expiringEquipment.map(item => {
      const expiryDate = new Date(item.certificate_expiry!);
      const today = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      return {
        'Código': item.internal_code,
        'Nome': item.name,
        'Categoria': item.categories?.name || '—',
        'Localização': item.location,
        'Data Vencimento': format(expiryDate, 'dd/MM/yyyy', { locale: ptBR }),
        'Dias Restantes': daysUntilExpiry,
        'Status': daysUntilExpiry < 0 ? 'Vencido' : 'A Vencer',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vencimentos');
    XLSX.writeFile(wb, `relatorio_vencimentos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de vencimentos exportado em Excel');
  };

  // Report 4: Non-Conformities Report
  const nonConformities = useMemo(() => {
    return filteredInspections.filter(i => 
      i.status === 'rejected' || i.status === 'non-compliant' || i.status === 'attention'
    );
  }, [filteredInspections]);

  const handleNonConformitiesReportPDF = () => {
    if (nonConformities.length === 0) {
      toast.error('Nenhuma não conformidade encontrada');
      return;
    }

    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Relatório de Não Conformidades', 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 30);
    doc.text(`Total de não conformidades: ${nonConformities.length}`, 14, 36);

    const tableData = nonConformities.map(item => [
      format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
      item.equipment?.name || '—',
      item.equipment?.internal_code || '—',
      item.profiles?.full_name || '—',
      item.status === 'attention' ? 'Atenção' : 'Não Conforme',
      item.observations?.substring(0, 40) || '—',
      item.recommendations?.substring(0, 40) || '—',
    ]);

    autoTable(doc, {
      startY: 44,
      head: [['Data', 'Equipamento', 'Código', 'Inspetor', 'Status', 'Observações', 'Recomendações']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [234, 88, 12] },
      alternateRowStyles: { fillColor: [255, 247, 237] },
    });

    doc.save(`relatorio_nao_conformidades_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('Relatório de não conformidades exportado em PDF');
  };

  const handleNonConformitiesReportExcel = () => {
    if (nonConformities.length === 0) {
      toast.error('Nenhuma não conformidade encontrada');
      return;
    }

    const data = nonConformities.map(item => ({
      'Data Inspeção': format(new Date(item.inspection_date), 'dd/MM/yyyy', { locale: ptBR }),
      'Equipamento': item.equipment?.name || '—',
      'Código': item.equipment?.internal_code || '—',
      'Inspetor': item.profiles?.full_name || '—',
      'Status': item.status === 'attention' ? 'Atenção' : 'Não Conforme',
      'Observações': item.observations || '—',
      'Recomendações': item.recommendations || '—',
      'Ações Tomadas': item.actions_taken || '—',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Não Conformidades');
    XLSX.writeFile(wb, `relatorio_nao_conformidades_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Relatório de não conformidades exportado em Excel');
  };

  const clearFilters = () => {
    setShipFilter('all');
    setCategoryFilter('all');
    setStartDateStr('');
    setEndDateStr('');
  };

  const hasFilters = shipFilter !== 'all' || categoryFilter !== 'all' || startDateStr || endDateStr;

  const reportTypes = [
    {
      id: 'inspections',
      title: 'Relatório de Inspeções',
      description: 'Relatório detalhado de inspeções por equipamento',
      icon: FileText,
      count: filteredInspections.length,
      onPDF: handleInspectionReportPDF,
      onExcel: handleInspectionReportExcel,
      iconColor: 'text-white',
      bgColor: 'bg-blue-600',
    },
    {
      id: 'category',
      title: 'Relatório por Categoria',
      description: 'Análise de equipamentos agrupados por categoria',
      icon: BarChart3,
      count: categories.filter(c => filteredEquipment.some(e => e.category_id === c.id)).length,
      onPDF: handleCategoryReportPDF,
      onExcel: handleCategoryReportExcel,
      iconColor: 'text-white',
      bgColor: 'bg-purple-600',
    },
    {
      id: 'expiry',
      title: 'Relatório de Vencimentos',
      description: 'Equipamentos com certificados próximos do vencimento',
      icon: Calendar,
      count: expiringEquipment.length,
      onPDF: handleExpiryReportPDF,
      onExcel: handleExpiryReportExcel,
      iconColor: 'text-white',
      bgColor: 'bg-red-600',
    },
    {
      id: 'non-conformities',
      title: 'Relatório de Não Conformidades',
      description: 'Histórico de não conformidades e ações corretivas',
      icon: AlertTriangle,
      count: nonConformities.length,
      onPDF: handleNonConformitiesReportPDF,
      onExcel: handleNonConformitiesReportExcel,
      iconColor: 'text-white',
      bgColor: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">
            Geração de relatórios profissionais para auditoria
          </p>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Limpar Filtros
          </Button>
        )}
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros Globais
          </CardTitle>
          <CardDescription>
            Aplique filtros que serão usados em todos os relatórios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Embarcação</Label>
              <Select value={shipFilter} onValueChange={setShipFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as embarcações" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as embarcações</SelectItem>
                  {ships.map(ship => (
                    <SelectItem key={ship.id} value={ship.id}>
                      {ship.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <DatePicker
                value={startDateStr}
                onChange={setStartDateStr}
                placeholder="Selecione..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data Fim</Label>
              <DatePicker
                value={endDateStr}
                onChange={setEndDateStr}
                placeholder="Selecione..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        /* Reports Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportTypes.map((report) => (
            <Card key={report.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${report.bgColor}`}>
                        <report.icon className={`h-5 w-5 ${report.iconColor}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{report.title}</CardTitle>
                      <CardDescription className="mt-1">{report.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    {report.count} {report.count === 1 ? 'item' : 'itens'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Separator className="mb-4" />
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="gap-2 flex-1"
                    onClick={report.onPDF}
                    disabled={report.count === 0}
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 flex-1"
                    onClick={report.onExcel}
                    disabled={report.count === 0}
                  >
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredEquipment.length}</p>
                <p className="text-sm text-muted-foreground">Equipamentos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{filteredInspections.length}</p>
                <p className="text-sm text-muted-foreground">Inspeções</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-500">{expiringEquipment.length}</p>
                <p className="text-sm text-muted-foreground">A Vencer</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{nonConformities.length}</p>
                <p className="text-sm text-muted-foreground">Não Conformidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
