import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { History, Search, Filter, ChevronDown, ChevronUp, Package, ClipboardCheck, User, Calendar, ArrowRight, Ship, Settings, UserCircle, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import i18n from '@/i18n';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuditLogs, AuditLog } from '@/hooks/useAuditLogs';
import { useShips } from '@/hooks/useShips';
import { Skeleton } from '@/components/ui/skeleton';
import { exportAuditLogsPDF, exportAuditLogsExcel } from '@/utils/exportAuditLogs';
import { toast } from 'sonner';

const getActionLabels = (t: (key: string) => string) => ({
  INSERT: { label: t('auditLogPage.actionCreate'), color: 'bg-green-500/20 text-green-600 border-green-500/30' },
  UPDATE: { label: t('auditLogPage.actionUpdate'), color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
  DELETE: { label: t('auditLogPage.actionDelete'), color: 'bg-red-500/20 text-red-600 border-red-500/30' },
});

const getTableLabels = (t: (key: string) => string) => ({
  equipment: { label: t('auditLogPage.tableEquipment'), icon: Package },
  inspections: { label: t('auditLogPage.tableInspection'), icon: ClipboardCheck },
  categories: { label: t('auditLogPage.tableCategory'), icon: Settings },
  ships: { label: t('auditLogPage.tableShip'), icon: Ship },
  profiles: { label: t('auditLogPage.tableProfile'), icon: UserCircle },
});

const getFieldLabels = (t: (key: string) => string): Record<string, string> => ({
  name: t('auditLogPage.fieldName'),
  internal_code: t('auditLogPage.fieldInternalCode'),
  status: t('auditLogPage.fieldStatus'),
  category_id: t('auditLogPage.fieldCategory'),
  ship_id: t('auditLogPage.fieldShip'),
  location: t('auditLogPage.fieldLocation'),
  manufacturer: t('auditLogPage.fieldManufacturer'),
  model: t('auditLogPage.fieldModel'),
  serial_number: t('auditLogPage.fieldSerialNumber'),
  acquisition_date: t('auditLogPage.fieldAcquisitionDate'),
  manufacturing_date: t('auditLogPage.fieldManufacturingDate'),
  expiry_date: t('auditLogPage.fieldExpiryDate'),
  certificate_expiry: t('auditLogPage.fieldCertificateExpiry'),
  next_inspection: t('auditLogPage.fieldNextInspection'),
  last_inspection: t('auditLogPage.fieldLastInspection'),
  observations: t('auditLogPage.fieldObservations'),
  inspection_date: t('auditLogPage.fieldInspectionDate'),
  inspector_id: t('auditLogPage.fieldInspector'),
  recommendations: t('auditLogPage.fieldRecommendations'),
  actions_taken: t('auditLogPage.fieldActionsTaken'),
  full_name: t('auditLogPage.fieldFullName'),
  email: t('auditLogPage.fieldEmail'),
  phone: t('auditLogPage.fieldPhone'),
  position: t('auditLogPage.fieldPosition'),
  department: t('auditLogPage.fieldDepartment'),
  description: t('auditLogPage.fieldDescription'),
  icon: t('auditLogPage.fieldIcon'),
  inspection_frequency: t('auditLogPage.fieldInspectionFrequency'),
  code: t('auditLogPage.fieldCode'),
});

function AuditLogItem({ log }: { log: AuditLog }) {
  const { t } = useTranslation();
  const actionLabels = getActionLabels(t);
  const tableLabels = getTableLabels(t);
  const fieldLabels = getFieldLabels(t);
  const dateLocale = i18n.language === 'pt-BR' ? ptBR : enUS;
  
  const [isOpen, setIsOpen] = useState(false);
  const action = actionLabels[log.action] || { label: log.action, color: 'bg-muted' };
  const table = tableLabels[log.table_name] || { label: log.table_name, icon: Package };
  const TableIcon = table.icon;

  const getChangeSummary = () => {
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
  };

  const renderFieldChange = (field: string) => {
    const label = fieldLabels[field] || field;
    const oldValue = log.old_data?.[field];
    const newValue = log.new_data?.[field];

    // Skip if values are the same or it's updated_at
    if (field === 'updated_at' || oldValue === newValue) return null;

    const formatValue = (val: any) => {
      if (val === null || val === undefined) return '—';
      if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

    return (
      <div key={field} className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
        <span className="text-sm font-medium text-muted-foreground min-w-[120px]">{label}:</span>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <span className="text-sm bg-red-500/10 text-red-600 px-2 py-0.5 rounded line-through">
            {formatValue(oldValue)}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className="text-sm bg-green-500/10 text-green-600 px-2 py-0.5 rounded">
            {formatValue(newValue)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="mb-3 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-lg bg-muted">
                  <TableIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{table.label}</span>
                    <Badge variant="outline" className={action.color}>
                      {action.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {getChangeSummary()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>{log.user_name || 'Sistema'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="bg-muted/30 rounded-lg p-3">
              {log.action === 'UPDATE' && log.changed_fields ? (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Alterações:</h4>
                  {log.changed_fields.map(field => renderFieldChange(field))}
                </div>
              ) : log.action === 'INSERT' ? (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Dados criados:</h4>
                  <pre className="text-xs bg-background/50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(log.new_data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Dados excluídos:</h4>
                  <pre className="text-xs bg-background/50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(log.old_data, null, 2)}
                  </pre>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-4 text-xs text-muted-foreground sm:hidden">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{log.user_name || 'Sistema'}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [shipFilter, setShipFilter] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  
  const { data: logs = [], isLoading } = useAuditLogs({ limit: 200 });
  const { data: ships = [] } = useShips();

  // Create a map of ship IDs to names for filtering
  const shipMap = useMemo(() => {
    const map: Record<string, string> = {};
    ships.forEach(ship => {
      map[ship.id] = ship.name;
    });
    return map;
  }, [ships]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Table filter
      if (tableFilter !== 'all' && log.table_name !== tableFilter) return false;
      
      // Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      
      // Ship filter - check ship_id in old_data or new_data
      if (shipFilter !== 'all') {
        const logShipId = log.new_data?.ship_id || log.old_data?.ship_id;
        // For ships table, check the record_id
        if (log.table_name === 'ships') {
          if (log.record_id !== shipFilter) return false;
        } else if (logShipId !== shipFilter) {
          return false;
        }
      }
      
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesUser = log.user_name?.toLowerCase().includes(searchLower);
        const matchesData = JSON.stringify(log.new_data || log.old_data).toLowerCase().includes(searchLower);
        if (!matchesUser && !matchesData) return false;
      }
      
      return true;
    });
  }, [logs, tableFilter, actionFilter, shipFilter, search]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return {
      total: logs.length,
      today: logs.filter(l => new Date(l.created_at) >= today).length,
      equipment: logs.filter(l => l.table_name === 'equipment').length,
      inspections: logs.filter(l => l.table_name === 'inspections').length,
    };
  }, [logs]);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const filters = {
        ship: shipFilter !== 'all' ? shipMap[shipFilter] : undefined,
        table: tableFilter !== 'all' ? tableFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      };
      await exportAuditLogsPDF(filteredLogs, filters);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      const filters = {
        ship: shipFilter !== 'all' ? shipMap[shipFilter] : undefined,
        table: tableFilter !== 'all' ? tableFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      };
      exportAuditLogsExcel(filteredLogs, filters);
      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar Excel');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start gap-4">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-2xl hidden sm:block">
            <History className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Histórico de Alterações</h1>
            <p className="text-muted-foreground mt-1">Auditoria completa de todas as modificações no sistema</p>
          </div>
        </div>
        
        {/* Export buttons */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={isExporting || filteredLogs.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total de Registros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">{stats.today}</div>
            <p className="text-sm text-muted-foreground">Alterações Hoje</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.equipment}</div>
            <p className="text-sm text-muted-foreground">Em Equipamentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.inspections}</div>
            <p className="text-sm text-muted-foreground">Em Inspeções</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por usuário ou dados..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={shipFilter} onValueChange={setShipFilter}>
              <SelectTrigger>
                <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Embarcação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as embarcações</SelectItem>
                {ships.map(ship => (
                  <SelectItem key={ship.id} value={ship.id}>{ship.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de registro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="equipment">Equipamentos</SelectItem>
                <SelectItem value="inspections">Inspeções</SelectItem>
                <SelectItem value="categories">Categorias</SelectItem>
                <SelectItem value="ships">Embarcações</SelectItem>
                <SelectItem value="profiles">Perfis</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criações</SelectItem>
                <SelectItem value="UPDATE">Atualizações</SelectItem>
                <SelectItem value="DELETE">Exclusões</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registros de Auditoria</CardTitle>
          <CardDescription>
            {filteredLogs.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum registro encontrado</p>
              </div>
            ) : (
              filteredLogs.map(log => (
                <AuditLogItem key={log.id} log={log} />
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
