import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
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
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Package, 
  MapPin, 
  Calendar, 
  FileText, 
  History,
  Edit,
  ClipboardCheck,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Tag,
  Factory,
  User,
  Upload,
  Trash2,
  Loader2,
  XCircle,
  Image,
  File,
  ExternalLink,
  Eye,
  Award,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { Equipment } from '@/types/equipment';
import { StatusBadge } from './StatusBadge';
import { cn } from '@/lib/utils';
import { formatDate } from '@/utils/dateFormat';
import { useInspectionsByEquipment } from '@/hooks/useInspections';
import { useEquipmentDocuments, useUploadDocument, useDeleteDocument, EquipmentDocument } from '@/hooks/useEquipmentDocuments';
import { useCertificates, type Certificate } from '@/hooks/useCertificates';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EquipmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onEdit?: () => void;
  onNewInspection?: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType === 'application/pdf') return FileText;
  return File;
}

export function EquipmentDetailDialog({ 
  open, 
  onOpenChange, 
  equipment,
  onEdit,
  onNewInspection,
}: EquipmentDetailDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const [deleteDocDialog, setDeleteDocDialog] = useState<{ open: boolean; doc: EquipmentDocument | null }>({
    open: false,
    doc: null,
  });

  const { data: inspections, isLoading: loadingInspections } = useInspectionsByEquipment(equipment?.id);
  const { data: documents, isLoading: loadingDocuments } = useEquipmentDocuments(equipment?.id);
  const { data: certificates, isLoading: loadingCertificates } = useCertificates({ equipmentId: equipment?.id });
  const uploadDocument = useUploadDocument();
  const deleteDocument = useDeleteDocument();

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    approved: { label: t('equipmentDetail.approved'), variant: 'default' },
    pending: { label: t('equipmentDetail.pending'), variant: 'secondary' },
    rejected: { label: t('equipmentDetail.rejected'), variant: 'destructive' },
  };

  if (!equipment) return null;

  const getDaysUntilExpiry = (date: string) => {
    if (!date) return 0;
    const expiry = new Date(date);
    const today = new Date();
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const certificateDays = equipment.certificateExpiry ? getDaysUntilExpiry(equipment.certificateExpiry) : 0;
  const inspectionDays = equipment.nextInspection ? getDaysUntilExpiry(equipment.nextInspection) : 0;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !equipment?.id) return;

    setUploadingFile(true);
    try {
      await uploadDocument.mutateAsync({ equipmentId: equipment.id, file });
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleView = async (filePath: string, fileType: string) => {
    try {
      toast({ title: t('equipmentDetail.loading'), description: t('equipmentDetail.openingDocument') });
      
      const { data, error } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(filePath, 300);
      
      if (error) {
        console.error('Error getting signed URL:', error);
        throw error;
      }
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      } else {
        throw new Error('URL não gerada');
      }
    } catch (error: any) {
      console.error('View error:', error);
      toast({
        title: t('equipmentDetail.errorViewing'),
        description: t('equipmentDetail.cannotOpenDocument'),
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      toast({ title: t('equipmentDetail.preparingDownload'), description: t('equipmentDetail.generatingLink') });
      
      const { data, error } = await supabase.storage
        .from('equipment-documents')
        .createSignedUrl(filePath, 60);
      
      if (error) {
        console.error('Error getting download URL:', error);
        throw error;
      }
      
      if (data?.signedUrl) {
        // Use fetch to download and create blob
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast({ title: t('equipmentDetail.downloadStarted'), description: fileName });
      } else {
        throw new Error('URL não gerada');
      }
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: t('equipmentDetail.errorDownloading'),
        description: t('equipmentDetail.cannotDownloadDocument'),
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!equipment?.id || !deleteDocDialog.doc) return;
    
    try {
      await deleteDocument.mutateAsync({ 
        id: deleteDocDialog.doc.id, 
        filePath: deleteDocDialog.doc.file_path, 
        equipmentId: equipment.id 
      });
      setDeleteDocDialog({ open: false, doc: null });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: t('equipmentDetail.errorDeleting'),
        description: t('equipmentDetail.cannotDeleteDocument'),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDocDialog.open} onOpenChange={(open) => setDeleteDocDialog({ open, doc: open ? deleteDocDialog.doc : null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('equipmentDetail.deleteDocument')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('equipmentDetail.deleteDocumentConfirm', { name: deleteDocDialog.doc?.file_name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('equipmentDetail.cancel')}</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocument.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('equipmentDetail.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Content - shared between Dialog/Drawer */}
      {(() => {
        const headerContent = (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-primary font-semibold">{equipment.internalCode}</span>
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <span className="font-semibold truncate">{equipment.name}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{equipment.category || equipment.categoryName}</Badge>
              <StatusBadge status={equipment.status} />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none" onClick={onEdit}>
                <Edit className="h-4 w-4" />
                {t('equipmentDetail.edit')}
              </Button>
              <Button size="sm" className="gap-2 flex-1 sm:flex-none" onClick={onNewInspection}>
                <ClipboardCheck className="h-4 w-4" />
                {t('equipmentDetail.newInspection')}
              </Button>
            </div>
          </div>
        );

        const mainContent = (
          <Tabs defaultValue="details" className="flex flex-col h-full">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent h-auto p-0 overflow-x-auto shrink-0">
              <TabsTrigger 
                value="details"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 text-sm"
              >
                <Package className="h-4 w-4 mr-1.5" />
                <span className="hidden xs:inline">{t('equipmentDetail.details')}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="inspections"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 text-sm"
              >
                <History className="h-4 w-4 mr-1.5" />
                <span className="hidden xs:inline">{t('equipmentDetail.inspections')}</span> ({inspections?.length || 0})
              </TabsTrigger>
              <TabsTrigger 
                value="documents"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 text-sm"
              >
                <FileText className="h-4 w-4 mr-1.5" />
                <span className="hidden xs:inline">{t('equipmentDetail.documents')}</span> ({documents?.length || 0})
              </TabsTrigger>
              <TabsTrigger 
                value="certificates"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 sm:px-4 py-3 text-sm"
              >
                <Award className="h-4 w-4 mr-1.5" />
                <span className="hidden xs:inline">{t('equipmentDetail.certificates')}</span> ({certificates?.length || 0})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1">
              {/* Details Tab */}
              <TabsContent value="details" className="mt-0 p-4 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Identification */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      {t('equipmentDetail.identification')}
                    </h3>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.internalCode')}</span>
                        <span className="font-mono font-medium text-right">{equipment.internalCode}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.name')}</span>
                        <span className="font-medium text-right">{equipment.name}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.category')}</span>
                        <span className="text-right">{equipment.category || equipment.categoryName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.type')}</span>
                        <span className="text-right">{equipment.type}</span>
                      </div>
                    </div>
                  </div>

                  {/* Technical */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Factory className="h-4 w-4 text-primary" />
                      {t('equipmentDetail.technicalData')}
                    </h3>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.manufacturer')}</span>
                        <span className="font-medium text-right">{equipment.manufacturer}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.model')}</span>
                        <span className="text-right">{equipment.model}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.serialNumber')}</span>
                        <span className="font-mono text-right">{equipment.serialNumber}</span>
                      </div>
                      {equipment.capacity && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground">{t('equipmentDetail.capacity')}</span>
                          <span className="font-medium text-right">{equipment.capacity}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {t('equipmentDetail.locationSection')}
                    </h3>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.unit')}</span>
                        <span className="font-medium text-right">{equipment.unit}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.physicalLocation')}</span>
                        <span className="text-right">{equipment.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      {t('equipmentDetail.datesSection')}
                    </h3>
                    <div className="space-y-3 pl-6">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.manufacturing')}</span>
                        <span className="text-right">{formatDate(equipment.manufacturingDate)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.acquisition')}</span>
                        <span className="text-right">{formatDate(equipment.acquisitionDate)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">{t('equipmentDetail.validity')}</span>
                        <span className="text-right">{formatDate(equipment.expiryDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                {/* Status Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Last Inspection */}
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-status-success" />
                      <span className="font-medium text-sm">{t('equipmentDetail.lastInspection')}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">
                      {equipment.lastInspection ? formatDate(equipment.lastInspection) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {inspections?.[0]?.status === 'approved' ? t('equipmentDetail.approved') : 
                       inspections?.[0]?.status === 'rejected' ? t('equipmentDetail.rejected') : '—'}
                    </p>
                  </div>

                  {/* Next Inspection */}
                  <div className={cn(
                    'p-4 rounded-lg border',
                    equipment.nextInspection ? (
                      inspectionDays <= 7 ? 'border-status-danger bg-status-danger/10' :
                      inspectionDays <= 30 ? 'border-status-warning bg-status-warning/10' :
                      'border-border bg-muted/30'
                    ) : 'border-border bg-muted/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className={cn(
                        'h-5 w-5',
                        equipment.nextInspection && inspectionDays <= 7 ? 'text-status-danger' :
                        equipment.nextInspection && inspectionDays <= 30 ? 'text-status-warning' :
                        'text-muted-foreground'
                      )} />
                      <span className="font-medium text-sm">{t('equipmentDetail.nextInspectionTitle')}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">
                      {equipment.nextInspection ? formatDate(equipment.nextInspection) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {equipment.nextInspection ? (
                        inspectionDays < 0 ? t('equipmentDetail.overdue') :
                        inspectionDays === 0 ? t('equipmentDetail.today') :
                        `${inspectionDays} ${t('equipmentDetail.daysRemaining')}`
                      ) : '—'}
                    </p>
                  </div>

                  {/* Certificate */}
                  <div className={cn(
                    'p-4 rounded-lg border',
                    equipment.certificateExpiry ? (
                      certificateDays <= 0 ? 'border-status-danger bg-status-danger/10' :
                      certificateDays <= 30 ? 'border-status-warning bg-status-warning/10' :
                      'border-border bg-muted/30'
                    ) : 'border-border bg-muted/30'
                  )}>
                    <div className="flex items-center gap-2 mb-2">
                      {equipment.certificateExpiry && certificateDays <= 0 ? (
                        <XCircle className="h-5 w-5 text-status-danger" />
                      ) : equipment.certificateExpiry && certificateDays <= 30 ? (
                        <AlertTriangle className="h-5 w-5 text-status-warning" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium text-sm">{t('equipmentDetail.certificateValidity')}</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold">
                      {equipment.certificateExpiry ? formatDate(equipment.certificateExpiry) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {equipment.certificateExpiry ? (
                        certificateDays < 0 ? t('equipmentDetail.expired') :
                        certificateDays === 0 ? t('equipmentDetail.expiresToday') :
                        `${certificateDays} ${t('equipmentDetail.daysRemaining')}`
                      ) : '—'}
                    </p>
                  </div>
                </div>

                {/* Observations */}
                {(equipment as any).observations && (
                  <>
                    <Separator className="my-6" />
                    <div className="space-y-2">
                      <h3 className="font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {t('equipmentDetail.observations')}
                      </h3>
                      <p className="text-muted-foreground whitespace-pre-wrap pl-6">
                        {(equipment as any).observations}
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* Inspections Tab */}
              <TabsContent value="inspections" className="mt-0 p-4 sm:p-6">
                {loadingInspections ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-4 p-4 border rounded-lg">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : inspections && inspections.length > 0 ? (
                  <div className="space-y-4">
                    {inspections.map((inspection) => (
                      <div 
                        key={inspection.id} 
                        className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className={cn(
                          'p-2 rounded-full shrink-0',
                          inspection.status === 'approved' ? 'bg-status-success/10' :
                          inspection.status === 'rejected' ? 'bg-status-danger/10' :
                          'bg-status-warning/10'
                        )}>
                          {inspection.status === 'approved' ? (
                            <CheckCircle2 className="h-5 w-5 text-status-success" />
                          ) : inspection.status === 'rejected' ? (
                            <XCircle className="h-5 w-5 text-status-danger" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-status-warning" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <p className="font-medium">
                              {formatDate(inspection.inspection_date)}
                            </p>
                            <Badge variant={
                              inspection.status === 'approved' ? 'default' :
                              inspection.status === 'rejected' ? 'destructive' :
                              'secondary'
                            }>
                              {inspection.status === 'approved' ? t('equipmentDetail.approved') :
                               inspection.status === 'rejected' ? t('equipmentDetail.rejected') :
                               t('equipmentDetail.pending')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{inspection.profiles?.full_name || t('inspections.inspector')}</span>
                          </div>
                          {inspection.observations && (
                            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                              {inspection.observations}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('equipmentDetail.noInspections')}</p>
                  </div>
                )}
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="mt-0 p-4 sm:p-6">
                {/* Upload Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h3 className="font-semibold">{t('equipmentDetail.documentsAndFiles')}</h3>
                    <p className="text-sm text-muted-foreground">{t('equipmentDetail.documentsDescription')}</p>
                  </div>
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileUpload}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif"
                    />
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingFile}
                    >
                      {uploadingFile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {t('equipmentDetail.uploadDocument')}
                    </Button>
                  </div>
                </div>

                {loadingDocuments ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : documents && documents.length > 0 ? (
                  <div className="space-y-3">
                    {documents.map((doc) => {
                      const FileIcon = getFileIcon(doc.file_type);
                      return (
                        <div 
                          key={doc.id} 
                          className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="p-2 bg-primary/10 rounded shrink-0">
                            <FileIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{doc.file_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {formatDate(doc.created_at)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleView(doc.file_path, doc.file_type)}
                              title={t('equipmentDetail.view')}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(doc.file_path, doc.file_name)}
                              title={t('equipmentDetail.download')}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteDocDialog({ open: true, doc })}
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">{t('equipmentDetail.noDocuments')}</p>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      {t('equipmentDetail.uploadFirstDocument')}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* Certificates Tab */}
              <TabsContent value="certificates" className="mt-0 p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold flex items-center gap-2">
                      <Award className="h-4 w-4 text-primary" />
                      {t('equipmentDetail.certificatesSection')}
                    </h3>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/certificates');
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t('equipmentDetail.viewAllCertificates')}
                  </Button>
                </div>

                {loadingCertificates ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : certificates && certificates.length > 0 ? (
                  <div className="space-y-3">
                    {certificates.map((cert) => {
                      const daysLeft = cert.expiry_date ? getDaysUntilExpiry(cert.expiry_date) : null;
                      return (
                        <div 
                          key={cert.id} 
                          className={cn(
                            "flex flex-col sm:flex-row sm:items-center gap-3 p-4 border rounded-lg transition-colors",
                            cert.status === 'expired' ? 'border-status-danger/50 bg-status-danger/5' :
                            cert.status === 'expiring_soon' ? 'border-status-warning/50 bg-status-warning/5' :
                            'hover:bg-muted/50'
                          )}
                        >
                          <div className={cn(
                            "p-2 rounded shrink-0",
                            cert.status === 'expired' ? 'bg-status-danger/10' :
                            cert.status === 'expiring_soon' ? 'bg-status-warning/10' :
                            'bg-green-500/10'
                          )}>
                            {cert.status === 'expired' ? (
                              <XCircle className="h-5 w-5 text-status-danger" />
                            ) : cert.status === 'expiring_soon' ? (
                              <AlertTriangle className="h-5 w-5 text-status-warning" />
                            ) : (
                              <ShieldCheck className="h-5 w-5 text-green-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cert.name}</p>
                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                              {cert.certificate_number && (
                                <span>Nº {cert.certificate_number}</span>
                              )}
                              {cert.issuer && (
                                <>
                                  <span className="hidden sm:inline">•</span>
                                  <span>{cert.issuer}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={cn(
                              cert.status === 'expired' ? 'bg-red-500/10 text-red-600 border-red-500/20' :
                              cert.status === 'expiring_soon' ? 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' :
                              'bg-green-500/10 text-green-600 border-green-500/20'
                            )}>
                              {cert.status === 'expired' ? t('certificates.status.expired') :
                               cert.status === 'expiring_soon' ? t('certificates.status.expiringSoon') :
                               t('certificates.status.valid')}
                            </Badge>
                            {cert.expiry_date && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(cert.expiry_date)}
                                {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                                  <span className="text-yellow-600 ml-1">({daysLeft}d)</span>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-2">{t('equipmentDetail.noCertificatesLinked')}</p>
                    <p className="text-sm text-muted-foreground mb-4">{t('equipmentDetail.addCertificateMessage')}</p>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => {
                        onOpenChange(false);
                        navigate('/certificates');
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t('equipmentDetail.addCertificate')}
                    </Button>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        );

        if (isMobile) {
          return (
            <Drawer open={open} onOpenChange={onOpenChange}>
              <DrawerContent className="max-h-[85vh] flex flex-col">
                <DrawerHeader className="text-left pb-2 border-b border-border shrink-0">
                  <DrawerTitle className="sr-only">{equipment.name}</DrawerTitle>
                  {headerContent}
                </DrawerHeader>
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {mainContent}
                </div>
              </DrawerContent>
            </Drawer>
          );
        }

        return (
          <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-card border border-border p-0" hideCloseButton>
              <DialogHeader className="p-6 pb-4 border-b border-border shrink-0">
                <DialogTitle className="sr-only">{equipment.name}</DialogTitle>
                <DialogDescription className="sr-only">{t('equipmentDetail.details')}</DialogDescription>
                {headerContent}
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {mainContent}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </>
  );
}