import { useState } from 'react';
import { ClipboardCheck, Calendar, Plus, Search, Eye, AlertTriangle, CheckCircle, XCircle, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useInspections, type InspectionWithDetails } from '@/hooks/useInspections';
import { format, isAfter, isBefore, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
  pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
  rejected: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
  conditional: { label: 'Condicional', variant: 'outline', icon: AlertTriangle },
};

export default function Inspections() {
  const { data: inspections = [], isLoading } = useInspections();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Calculate statistics
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  
  const pendingInspections = inspections.filter(i => i.status === 'pending').length;
  const completedThisMonth = inspections.filter(i => {
    const date = new Date(i.inspection_date);
    return isAfter(date, monthStart) && isBefore(date, monthEnd) && i.status !== 'pending';
  }).length;
  const nonConformant = inspections.filter(i => i.status === 'rejected' || i.status === 'conditional').length;

  // Filter inspections
  const filteredInspections = inspections.filter(inspection => {
    const matchesSearch = 
      inspection.equipment?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.equipment?.internal_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inspection.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || inspection.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get upcoming inspections (next 30 days based on next_inspection_date)
  const upcomingInspections = inspections
    .filter(i => i.next_inspection_date && isAfter(new Date(i.next_inspection_date), now) && isBefore(new Date(i.next_inspection_date), addDays(now, 30)))
    .sort((a, b) => new Date(a.next_inspection_date!).getTime() - new Date(b.next_inspection_date!).getTime());

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inspeções</h1>
          <p className="text-muted-foreground">
            Gerenciamento de inspeções e checklists
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Inspeção
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <ClipboardCheck className="h-5 w-5 text-status-success" />
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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Inspeções</CardTitle>
          <CardDescription>Todas as inspeções realizadas no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
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
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="rejected">Reprovado</SelectItem>
                <SelectItem value="conditional">Condicional</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
                      {searchTerm || statusFilter !== 'all' 
                        ? 'Nenhuma inspeção encontrada com os filtros aplicados.' 
                        : 'Nenhuma inspeção registrada ainda.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInspections.map((inspection) => (
                    <TableRow key={inspection.id}>
                      <TableCell className="font-medium">
                        {inspection.equipment?.name || 'Equipamento não encontrado'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inspection.equipment?.internal_code || '-'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {inspection.profiles?.full_name || 'Inspetor não encontrado'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(inspection.status)}
                      </TableCell>
                      <TableCell>
                        {inspection.next_inspection_date 
                          ? format(new Date(inspection.next_inspection_date), 'dd/MM/yyyy', { locale: ptBR })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

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
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
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
                      {format(new Date(inspection.next_inspection_date!), 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(inspection.next_inspection_date!), 'EEEE', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
