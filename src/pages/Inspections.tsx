import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  ClipboardCheck, 
  Calendar, 
  Plus, 
  Search, 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  User,
  X,
  QrCode,
  CalendarDays,
  List,
  GitCommitHorizontal,
  Edit,
  MoreHorizontal,
  Trash2,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useInspections, type InspectionWithDetails } from '@/hooks/useInspections';
import { useProfiles } from '@/hooks/useProfiles';
import { useEquipmentById } from '@/hooks/useEquipment';
import { isAfter, isBefore, addDays, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { formatDate, formatWeekday } from '@/utils/dateFormat';
import { InspectionDetailDialog } from '@/components/inspections/InspectionDetailDialog';
import { NewInspectionDialog } from '@/components/inspections/NewInspectionDialog';
import { EditInspectionDialog } from '@/components/inspections/EditInspectionDialog';
import { QRCodeScannerDialog } from '@/components/equipment/QRCodeScannerDialog';
import { InspectionCalendar } from '@/components/inspections/InspectionCalendar';
import { InspectionTimeline } from '@/components/inspections/InspectionTimeline';
import { CategoryInspectionTab } from '@/components/inspections/CategoryInspectionTab';
import { exportInspectionsToExcel, exportInspectionsToPDF } from '@/utils/exportInspections';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  compliant: { label: 'Conforme', variant: 'default', icon: CheckCircle },
  attention: { label: 'Atenção', variant: 'outline', icon: AlertTriangle },
  'non-compliant': { label: 'Não Conforme', variant: 'destructive', icon: XCircle },
  // Legacy values for backwards compatibility
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
  conditional: { label: 'Condicional', variant: 'outline', icon: AlertTriangle },
};

export default function Inspections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const scanEquipmentId = searchParams.get('scan');
  
  const { data: inspections = [], isLoading } = useInspections();
  const { data: profiles = [] } = useProfiles();
  const { data: scannedEquipment } = useEquipmentById(scanEquipmentId || undefined);
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inspectorFilter, setInspectorFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [selectedInspection, setSelectedInspection] = useState<InspectionWithDetails | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [showNewInspectionForm, setShowNewInspectionForm] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline' | 'category'>('list');
  const [preselectedEquipmentId, setPreselectedEquipmentId] = useState<string | null>(null);

  // Auto-open form when scanning QR code - trigger immediately on scan param
  useEffect(() => {
    if (scanEquipmentId) {
      console.log('[Inspections] QR scan detected, opening form for equipment:', scanEquipmentId);
      setPreselectedEquipmentId(scanEquipmentId);
      setShowNewInspectionForm(true);
      
      // Show toast when equipment data is loaded
      if (scannedEquipment) {
        toast({
          title: 'QR Code detectado',
          description: `Iniciando inspeção para: ${scannedEquipment.internal_code} - ${scannedEquipment.name}`,
        });
      }
    }
  }, [scanEquipmentId, scannedEquipment, toast]);

  // Clear scan param after form closes
  const handleFormSuccess = () => {
    setShowNewInspectionForm(false);
    setPreselectedEquipmentId(null);
    if (scanEquipmentId) {
      setSearchParams({});
    }
  };

  const handleFormCancel = () => {
    setShowNewInspectionForm(false);
    setPreselectedEquipmentId(null);
    if (scanEquipmentId) {
      setSearchParams({});
    }
  };

  // Get unique inspectors from inspections
  const inspectors = useMemo(() => {
    const uniqueInspectors = new Map<string, { id: string; name: string }>();
    inspections.forEach(i => {
      if (i.profiles && i.inspector_id) {
        uniqueInspectors.set(i.inspector_id, { 
          id: i.inspector_id, 
          name: i.profiles.full_name 
        });
      }
    });
    return Array.from(uniqueInspectors.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [inspections]);

  // Calculate statistics
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const pendingInspections = inspections.filter(i => i.status === 'attention').length;
  const completedThisMonth = inspections.filter(i => {
    const date = new Date(i.inspection_date);
    return isAfter(date, monthStart) && isBefore(date, monthEnd) && i.status === 'compliant';
  }).length;
  const nonConformant = inspections.filter(i => i.status === 'non-compliant' || i.status === 'attention').length;

  // Filter inspections
  const filteredInspections = useMemo(() => {
    return inspections.filter(inspection => {
      const matchesSearch = 
        inspection.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inspection.equipment?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inspection.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inspection.status === statusFilter;
      const matchesInspector = inspectorFilter === 'all' || inspection.inspector_id === inspectorFilter;
      
      const inspectionDate = parseISO(inspection.inspection_date);
      const matchesDateFrom = !dateFrom || isAfter(inspectionDate, parseISO(dateFrom)) || inspection.inspection_date === dateFrom;
      const matchesDateTo = !dateTo || isBefore(inspectionDate, parseISO(dateTo)) || inspection.inspection_date === dateTo;
      
      return matchesSearch && matchesStatus && matchesInspector && matchesDateFrom && matchesDateTo;
    });
  }, [inspections, searchTerm, statusFilter, inspectorFilter, dateFrom, dateTo]);

  // Get upcoming inspections (next 30 days based on next_inspection_date)
  const upcomingInspections = inspections
    .filter(i => i.next_inspection_date && isAfter(new Date(i.next_inspection_date), now) && isBefore(new Date(i.next_inspection_date), addDays(now, 30)))
    .sort((a, b) => new Date(a.next_inspection_date!).getTime() - new Date(b.next_inspection_date!).getTime());

  const hasActiveFilters = statusFilter !== 'all' || inspectorFilter !== 'all' || dateFrom || dateTo;

  const clearFilters = () => {
    setStatusFilter('all');
    setInspectorFilter('all');
    setDateFrom('');
    setDateTo('');
    setSearchTerm('');
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const openDetailDialog = (inspection: InspectionWithDetails) => {
    setSelectedInspection(inspection);
    setDetailDialogOpen(true);
  };

  const handleEditInspection = (inspection: InspectionWithDetails) => {
    setSelectedInspection(inspection);
    setDetailDialogOpen(false);
    setEditDialogOpen(true);
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    setSelectedInspection(null);
  };

  const handleExportExcel = () => {
    exportInspectionsToExcel(filteredInspections);
  };

  const handleExportPDF = async () => {
    toast({ title: 'Gerando relatório...', description: 'Aguarde enquanto o PDF é preparado.' });
    await exportInspectionsToPDF(filteredInspections);
    toast({ title: 'Sucesso!', description: 'Relatório exportado com sucesso.' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inspeções</h1>
          <p className="text-muted-foreground">
            Gerenciamento de inspeções e checklists
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
              <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" className="gap-2" onClick={() => setShowQRScanner(true)}>
            <QrCode className="h-4 w-4" />
            Ler QR Code
          </Button>
          <Button className="gap-2" onClick={() => setShowNewInspectionForm(true)}>
            <Plus className="h-4 w-4" />
            Nova Inspeção
          </Button>
        </div>
      </div>

      {/* QR Code Scanner Dialog */}
      <QRCodeScannerDialog
        open={showQRScanner}
        onOpenChange={setShowQRScanner}
        onScan={(equipmentId) => {
          console.log('[Inspections] QR scanned from internal scanner:', equipmentId);
          setSearchParams({ scan: equipmentId });
          setPreselectedEquipmentId(equipmentId);
          setShowNewInspectionForm(true);
          setShowQRScanner(false);
        }}
      />

      {/* QR Code Scan Indicator */}
      {scanEquipmentId && scannedEquipment && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <QrCode className="h-6 w-6 text-primary" />
            <div className="flex-1">
              <p className="font-medium">Inspeção via QR Code</p>
              <p className="text-sm text-muted-foreground">
                Equipamento: {scannedEquipment.internal_code} - {scannedEquipment.name}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleFormCancel}>
              <X className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* New Inspection Dialog */}
      <NewInspectionDialog
        open={showNewInspectionForm}
        onOpenChange={(open) => {
          setShowNewInspectionForm(open);
          if (!open) handleFormCancel();
        }}
        preSelectedEquipmentId={scanEquipmentId}
      />

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Total
            </CardTitle>
            <CardDescription>Todas as inspeções</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{inspections.length}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-status-warning" />
              Pendentes
            </CardTitle>
            <CardDescription>Inspeções agendadas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{pendingInspections}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle className="h-5 w-5 text-status-success" />
              Realizadas (Mês)
            </CardTitle>
            <CardDescription>Inspeções concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{completedThisMonth}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-status-danger" />
              Não Conformes
            </CardTitle>
            <CardDescription>Requerem ação</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-3xl font-bold">{nonConformant}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'list' | 'calendar' | 'timeline' | 'category')}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <List className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="category" className="gap-2">
            <Layers className="h-4 w-4" />
            Por Categoria
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <GitCommitHorizontal className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {/* List View */}
        <TabsContent value="list" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Inspeções</CardTitle>
              <CardDescription>Todas as inspeções realizadas no sistema</CardDescription>
            </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por equipamento ou inspetor..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="compliant">Conforme</SelectItem>
                <SelectItem value="attention">Atenção</SelectItem>
                <SelectItem value="non-compliant">Não Conforme</SelectItem>
              </SelectContent>
            </Select>

            <Select value={inspectorFilter} onValueChange={setInspectorFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <User className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Inspetor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Inspetores</SelectItem>
                {inspectors.map(inspector => (
                  <SelectItem key={inspector.id} value={inspector.id}>
                    {inspector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="De"
                className="w-full lg:w-[160px]"
                fromYear={new Date().getFullYear() - 10}
                toYear={new Date().getFullYear() + 1}
              />
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                placeholder="Até"
                className="w-full lg:w-[160px]"
                fromYear={new Date().getFullYear() - 10}
                toYear={new Date().getFullYear() + 1}
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Mostrando {filteredInspections.length} de {inspections.length} inspeções
            </div>
          )}

          {/* Inspections Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Inspetor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Próxima</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredInspections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm || hasActiveFilters
                        ? 'Nenhuma inspeção encontrada com os filtros aplicados.' 
                        : 'Nenhuma inspeção registrada ainda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInspections.map((inspection) => (
                    <TableRow 
                      key={inspection.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onDoubleClick={() => openDetailDialog(inspection)}
                    >
                      <TableCell className="font-medium">
                        {inspection.equipment?.name || 'Equipamento não encontrado'}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono">
                        {inspection.equipment?.internal_code || '-'}
                      </TableCell>
                      <TableCell>
                        {formatDate(inspection.inspection_date)}
                      </TableCell>
                      <TableCell>
                        {inspection.profiles?.full_name || 'Inspetor não encontrado'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(inspection.status)}
                      </TableCell>
                      <TableCell>
                        {inspection.next_inspection_date 
                          ? formatDate(inspection.next_inspection_date)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border border-border shadow-lg">
                            <DropdownMenuItem 
                              onClick={() => openDetailDialog(inspection)}
                              className="gap-2 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleEditInspection(inspection)}
                              className="gap-2 cursor-pointer"
                            >
                              <Edit className="h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDetailDialog(inspection)}
                              className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-muted-foreground">
            Total: {filteredInspections.length} inspeções
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline View */}
        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline de Inspeções</CardTitle>
              <CardDescription>Histórico visual das inspeções realizadas</CardDescription>
            </CardHeader>
            <CardContent>
              <InspectionTimeline 
                inspections={filteredInspections}
                onViewDetails={openDetailDialog}
                onEdit={handleEditInspection}
                maxItems={10}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-6">
          <InspectionCalendar 
            inspections={inspections} 
            onInspectionClick={(inspection) => {
              setSelectedInspection(inspection);
              setDetailDialogOpen(true);
            }}
          />
        </TabsContent>

        {/* Category Inspection View */}
        <TabsContent value="category" className="mt-6">
          <CategoryInspectionTab />
        </TabsContent>
      </Tabs>

      {/* Upcoming Inspections */}
      {upcomingInspections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Próximas Inspeções
            </CardTitle>
            <CardDescription>Inspeções agendadas para os próximos 30 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingInspections.slice(0, 5).map((inspection) => (
                <div 
                  key={inspection.id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => openDetailDialog(inspection)}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{inspection.equipment?.name}</p>
                      <p className="text-sm text-muted-foreground">{inspection.equipment?.internal_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatDate(inspection.next_inspection_date!)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatWeekday(inspection.next_inspection_date!)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Dialog */}
      <InspectionDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        inspection={selectedInspection}
        onEdit={handleEditInspection}
      />

      {/* Edit Dialog */}
      <EditInspectionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        inspection={selectedInspection}
        onSuccess={handleEditSuccess}
      />

    </div>
  );
}
