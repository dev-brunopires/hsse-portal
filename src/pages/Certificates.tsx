import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Search,
  Download,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Filter,
  Eye,
  Pencil,
  RotateCw,
  Trash2,
  MoreHorizontal,
  Zap,
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useCertificates, useCertificateStats, useDeleteCertificate, type Certificate } from '@/hooks/useCertificates';
import { useSyncAllCertificates } from '@/hooks/useSyncEquipmentCertificates';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

import { CertificateFormDialog } from '@/components/certificates/CertificateFormDialog';
import { CertificateDetailDialog } from '@/components/certificates/CertificateDetailDialog';
import { RenewCertificateDialog } from '@/components/certificates/RenewCertificateDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const CERTIFICATE_TYPES = [
  { value: 'all', label: 'certificates.types.all' },
  { value: 'certificate', label: 'certificates.types.certificate' },
  { value: 'document', label: 'certificates.types.document' },
  { value: 'license', label: 'certificates.types.license' },
  { value: 'permit', label: 'certificates.types.permit' },
  { value: 'test_report', label: 'certificates.types.testReport' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'certificates.status.all' },
  { value: 'valid', label: 'certificates.status.valid' },
  { value: 'expiring_soon', label: 'certificates.status.expiringSoon' },
  { value: 'expired', label: 'certificates.status.expired' },
];

export default function Certificates() {
  const { t, i18n } = useTranslation();
  const isMobile = useIsMobile();
  const dateLocale = i18n.language === 'en' ? enUS : ptBR;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRenewOpen, setIsRenewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [certificateToDelete, setCertificateToDelete] = useState<Certificate | null>(null);

  const deleteCertificate = useDeleteCertificate();
  const syncCertificates = useSyncAllCertificates();

  const expiringDays = activeTab === 'expiring' ? 30 : undefined;

  const { data: certificates = [], isLoading, refetch, isFetching } = useCertificates({
    status: activeTab === 'expired' ? 'expired' : statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    expiringDays,
  });

  const { data: stats } = useCertificateStats();

  const filteredCertificates = useMemo(() => {
    if (!search.trim()) return certificates;
    const searchLower = search.toLowerCase();

    return certificates.filter((cert) => {
      const name = (cert.name ?? '').toLowerCase();
      const equipmentName = (cert.equipment?.name ?? '').toLowerCase();
      const equipmentCode = (cert.equipment?.internal_code ?? '').toLowerCase();
      const certNumber = (cert.certificate_number ?? '').toLowerCase();
      const issuer = (cert.issuer ?? '').toLowerCase();

      return (
        name.includes(searchLower) ||
        equipmentName.includes(searchLower) ||
        equipmentCode.includes(searchLower) ||
        certNumber.includes(searchLower) ||
        issuer.includes(searchLower)
      );
    });
  }, [certificates, search]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'valid':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <ShieldCheck className="h-3 w-3 mr-1" />
            {t('certificates.status.valid')}
          </Badge>
        );
      case 'expiring_soon':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            {t('certificates.status.expiringSoon')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t('certificates.status.expired')}
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; label: string }> = {
      certificate: { color: 'bg-blue-500/10 text-blue-600', label: t('certificates.types.certificate') },
      document: { color: 'bg-purple-500/10 text-purple-600', label: t('certificates.types.document') },
      license: { color: 'bg-green-500/10 text-green-600', label: t('certificates.types.license') },
      permit: { color: 'bg-orange-500/10 text-orange-600', label: t('certificates.types.permit') },
      test_report: { color: 'bg-cyan-500/10 text-cyan-600', label: t('certificates.types.testReport') },
    };
    const config = typeConfig[type] || { color: 'bg-muted', label: type };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    return differenceInDays(parseISO(expiryDate), new Date());
  };

  const handleOpenDetail = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setIsDetailOpen(true);
  };

  const handleOpenRenew = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setIsRenewOpen(true);
  };

  const handleEdit = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setIsFormOpen(true);
  };

  const handleDelete = (certificate: Certificate) => {
    setCertificateToDelete(certificate);
    setIsDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (certificateToDelete) {
      await deleteCertificate.mutateAsync(certificateToDelete.id);
      setIsDeleteOpen(false);
      setCertificateToDelete(null);
    }
  };

  const renderCertificateCard = (certificate: Certificate) => {
    const daysLeft = getDaysUntilExpiry(certificate.expiry_date);

    return (
      <Card key={certificate.id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{certificate.name}</h3>
                {getTypeBadge(certificate.type)}
              </div>
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {certificate.equipment?.name} ({certificate.equipment?.internal_code})
              </p>
              {certificate.certificate_number && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nº {certificate.certificate_number}
                </p>
              )}
            </div>
            {getStatusBadge(certificate.status)}
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div>
              <span className="text-muted-foreground">{t('certificates.expiryDate')}:</span>{' '}
              <span className={cn(
                'font-medium',
                daysLeft !== null && daysLeft <= 0 && 'text-red-600',
                daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && 'text-yellow-600'
              )}>
                {certificate.expiry_date ? formatDate(certificate.expiry_date) : '-'}
              </span>
              {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                <span className="text-xs text-yellow-600 ml-1">
                  ({daysLeft} {t('expiringCertificates.days')})
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => handleOpenDetail(certificate)}
            >
              {t('common.details')}
            </Button>
            {(certificate.status === 'expired' || certificate.status === 'expiring_soon') && (
              <Button
                variant="default"
                size="sm"
                className="flex-1"
                onClick={() => handleOpenRenew(certificate)}
              >
                {t('certificates.renew')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={FileText}
        title={t('certificates.title')}
        subtitle={t('certificates.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncCertificates.mutate()}
              disabled={syncCertificates.isPending}
              title={t('certificates.syncTooltip')}
            >
              <Zap className={cn('h-4 w-4', syncCertificates.isPending && 'animate-pulse')} />
              <span className="hidden sm:inline ml-2">{t('certificates.syncFromEquipment')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              <span className="hidden sm:inline ml-2">{t('common.refresh')}</span>
            </Button>
            <Button onClick={() => { setSelectedCertificate(null); setIsFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">{t('certificates.add')}</span>
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('certificates.stats.total')}</p>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('certificates.stats.valid')}</p>
                <p className="text-2xl font-bold text-green-600">{stats?.valid || 0}</p>
              </div>
              <ShieldCheck className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('certificates.stats.expiring30')}</p>
                <p className="text-2xl font-bold text-yellow-600">{stats?.expiring30 || 0}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('certificates.stats.expired')}</p>
                <p className="text-2xl font-bold text-red-600">{stats?.expired || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">
            {t('certificates.tabs.all')}
            <Badge variant="secondary" className="ml-2">{stats?.total || 0}</Badge>
          </TabsTrigger>
          <TabsTrigger value="expiring">
            {t('certificates.tabs.expiring')}
            <Badge variant="secondary" className="ml-2 bg-yellow-500/20 text-yellow-600">
              {stats?.expiring30 || 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="expired">
            {t('certificates.tabs.expired')}
            <Badge variant="secondary" className="ml-2 bg-red-500/20 text-red-600">
              {stats?.expired || 0}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('certificates.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder={t('certificates.filterType')} />
              </SelectTrigger>
              <SelectContent>
                {CERTIFICATE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(type.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTab === 'all' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder={t('certificates.filterStatus')} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {t(status.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-8 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredCertificates.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">{t('certificates.noCertificates')}</h3>
                <p className="text-muted-foreground text-center mt-1">
                  {t('certificates.noCertificatesDesc')}
                </p>
                <Button className="mt-4" onClick={() => { setSelectedCertificate(null); setIsFormOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('certificates.add')}
                </Button>
              </CardContent>
            </Card>
          ) : isMobile ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredCertificates.map(renderCertificateCard)}
            </div>
          ) : (
            <Card>
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('certificates.name')}</TableHead>
                      <TableHead>{t('certificates.type')}</TableHead>
                      <TableHead>{t('certificates.equipment')}</TableHead>
                      <TableHead>{t('certificates.issuer')}</TableHead>
                      <TableHead>{t('certificates.expiryDate')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead className="text-right">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCertificates.map((certificate) => {
                      const daysLeft = getDaysUntilExpiry(certificate.expiry_date);
                      return (
                        <TableRow
                          key={certificate.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleOpenDetail(certificate)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{certificate.name}</p>
                              {certificate.certificate_number && (
                                <p className="text-xs text-muted-foreground">
                                  Nº {certificate.certificate_number}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getTypeBadge(certificate.type)}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{certificate.equipment?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {certificate.equipment?.internal_code}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{certificate.issuer || '-'}</TableCell>
                          <TableCell>
                            <div className={cn(
                              daysLeft !== null && daysLeft <= 0 && 'text-red-600',
                              daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && 'text-yellow-600'
                            )}>
                              {certificate.expiry_date ? formatDate(certificate.expiry_date) : '-'}
                              {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                                <p className="text-xs">
                                  ({daysLeft} {t('expiringCertificates.days')})
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(certificate.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-background">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenDetail(certificate); }}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  {t('common.viewDetails')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(certificate); }}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                {(certificate.status === 'expired' || certificate.status === 'expiring_soon') && (
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenRenew(certificate); }}>
                                    <RotateCw className="h-4 w-4 mr-2" />
                                    {t('certificates.renew')}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem 
                                  onClick={(e) => { e.stopPropagation(); handleDelete(certificate); }}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CertificateFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        certificate={selectedCertificate}
      />

      <CertificateDetailDialog
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        certificate={selectedCertificate}
        onEdit={handleEdit}
        onRenew={handleOpenRenew}
      />

      <RenewCertificateDialog
        open={isRenewOpen}
        onOpenChange={setIsRenewOpen}
        certificate={selectedCertificate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('certificates.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('certificates.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCertificate.isPending ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
