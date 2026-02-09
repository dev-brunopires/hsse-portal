import { useState, useMemo, useEffect } from 'react';
import { 
  Layers, 
  Check, 
  CheckSquare, 
  Square, 
  Loader2, 
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCategories } from '@/hooks/useCategories';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { useShips } from '@/hooks/useShips';
import { useUserSignature } from '@/hooks/useUserSignature';
import { useUserShips } from '@/hooks/useUserShips';
import { useDefaultChecklistTemplate } from '@/hooks/useChecklistTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';
import { exportCategoryInspectionPDF } from '@/utils/exportCategoryInspection';
import { formatDate } from '@/utils/dateFormat';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useOrganizationBranding } from '@/hooks/useOrganizationBranding';

// Calculate next inspection date based on category frequency
function calculateNextInspectionDate(inspectionDate: string, frequency: string): string {
  const date = new Date(inspectionDate);
  switch (frequency) {
    case 'monthly': date.setDate(date.getDate() + 30); break;
    case 'quarterly': date.setDate(date.getDate() + 90); break;
    case 'semi-annual': case 'semiannual': date.setDate(date.getDate() + 180); break;
    case 'annual': date.setDate(date.getDate() + 365); break;
    default: date.setDate(date.getDate() + 30);
  }
  return date.toISOString().split('T')[0];
}

interface CategoryInspectionResult {
  equipment: EquipmentWithCategory;
  status: 'compliant' | 'attention' | 'non-compliant';
}

export function CategoryInspectionTab() {
  const { t } = useTranslation();
  const { user, isAdmin, isAdminMaster } = useAuth();
  const { selectedShipId } = useShipFilter();
  const branding = useOrganizationBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch full profile with position
  const { data: fullProfile } = useQuery({
    queryKey: ['profile-full', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  const { data: categories = [], isLoading: categoriesLoading } = useCategories();
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: allShips = [] } = useShips();
  const { data: userSignatureSettings, isLoading: signatureLoading } = useUserSignature();
  const { data: userShips = [] } = useUserShips(user?.id);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedShip, setSelectedShip] = useState<string>('');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [equipmentStatuses, setEquipmentStatuses] = useState<Record<string, 'compliant' | 'attention' | 'non-compliant'>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [inspectionResults, setInspectionResults] = useState<CategoryInspectionResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);
  
  // Fetch default checklist for the selected category
  const { data: defaultChecklist } = useDefaultChecklistTemplate(selectedCategory || undefined);
  
  // Determine available ships based on user role
  const availableShips = useMemo(() => {
    // Admin and admin_master can see all ships
    if (isAdmin || isAdminMaster) {
      return allShips;
    }
    // Technicians and supervisors only see their assigned ships
    return userShips.map(us => us.ship).filter(Boolean) as { id: string; name: string; code: string | null }[];
  }, [allShips, userShips, isAdmin, isAdminMaster]);

  // Auto-select ship if user has only one assigned (for technicians/supervisors)
  useEffect(() => {
    if (!selectedShip && availableShips.length === 1) {
      setSelectedShip(availableShips[0].id);
    } else if (!selectedShip && selectedShipId && availableShips.some(s => s.id === selectedShipId)) {
      // Use the global filter if set and available
      setSelectedShip(selectedShipId);
    }
  }, [availableShips, selectedShip, selectedShipId]);

  // Filter equipment by category, ship, and search query
  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      const matchesCategory = !selectedCategory || eq.category_id === selectedCategory;
      const matchesShip = !selectedShip || eq.ship_id === selectedShip;
      const searchLower = searchQuery.toLowerCase().trim();
      const matchesSearch = !searchLower || 
        eq.internal_code.toLowerCase().includes(searchLower) ||
        eq.location.toLowerCase().includes(searchLower) ||
        eq.name.toLowerCase().includes(searchLower);
      return matchesCategory && matchesShip && matchesSearch;
    });
  }, [equipment, selectedCategory, selectedShip, searchQuery]);

  const selectedCategory$ = categories.find(c => c.id === selectedCategory);
  const selectedShip$ = availableShips.find(s => s.id === selectedShip);

  const isAllSelected = filteredEquipment.length > 0 && 
    filteredEquipment.every(eq => selectedEquipmentIds.has(eq.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEquipmentIds(new Set());
    } else {
      const newIds = new Set(filteredEquipment.map(eq => eq.id));
      setSelectedEquipmentIds(newIds);
      // Set all to compliant by default when selecting all
      const newStatuses = { ...equipmentStatuses };
      filteredEquipment.forEach(eq => {
        if (!newStatuses[eq.id]) {
          newStatuses[eq.id] = 'compliant';
        }
      });
      setEquipmentStatuses(newStatuses);
    }
  };

  const handleSelectEquipment = (equipmentId: string) => {
    const newSet = new Set(selectedEquipmentIds);
    if (newSet.has(equipmentId)) {
      newSet.delete(equipmentId);
    } else {
      newSet.add(equipmentId);
      // Set default status to compliant when selecting
      if (!equipmentStatuses[equipmentId]) {
        setEquipmentStatuses(prev => ({ ...prev, [equipmentId]: 'compliant' }));
      }
    }
    setSelectedEquipmentIds(newSet);
  };

  const handleStatusChange = (equipmentId: string, status: 'compliant' | 'attention' | 'non-compliant') => {
    setEquipmentStatuses(prev => ({ ...prev, [equipmentId]: status }));
  };

  const getStatusLabel = (status: 'compliant' | 'attention' | 'non-compliant') => {
    switch (status) {
      case 'compliant': return t('categoryInspection.compliant');
      case 'attention': return t('categoryInspection.attentionStatus');
      case 'non-compliant': return t('categoryInspection.nonCompliantStatus');
    }
  };

  const handleStartInspection = () => {
    if (selectedEquipmentIds.size === 0) {
      toast({
        title: t('categoryInspection.noEquipmentSelected'),
        description: t('categoryInspection.selectAtLeastOne'),
        variant: 'destructive',
      });
      return;
    }

    // Wait for signature settings to load
    if (signatureLoading) {
      toast({
        title: t('categoryInspection.loadingSignatureSettings'),
        description: t('categoryInspection.loadingSignatureDescription'),
      });
      return;
    }

    // Check if user has auto-sign enabled AND has a signature saved
    if (userSignatureSettings?.auto_sign_inspections === true && userSignatureSettings?.default_signature) {
      setSignatureData(userSignatureSettings.default_signature);
      handleSubmitInspections(userSignatureSettings.default_signature);
    } else {
      setShowSignatureDialog(true);
    }
  };

  const handleSignatureSave = (signature: string) => {
    setSignatureData(signature);
    setShowSignatureDialog(false);
    handleSubmitInspections(signature);
  };

  const handleSubmitInspections = async (signature: string) => {
    if (!user?.id || !selectedCategory) return;

    setIsSubmitting(true);
    const results: CategoryInspectionResult[] = [];

    try {
      const selectedEquipments = filteredEquipment.filter(eq => 
        selectedEquipmentIds.has(eq.id)
      );

      const inspectionDate = new Date().toISOString().split('T')[0];

      // Fetch category frequency to calculate next inspection date
      const category = categories.find(c => c.id === selectedCategory);
      const frequency = category?.inspection_frequency || 'monthly';
      const nextDate = calculateNextInspectionDate(inspectionDate, frequency);

      // Build all inspection records
      const inspectionRecords = selectedEquipments.map(eq => {
        const eqStatus = equipmentStatuses[eq.id] || 'compliant';
        return {
          equipment_id: eq.id,
          inspector_id: user.id,
          status: eqStatus === 'compliant' ? 'compliant' : 
                  eqStatus === 'attention' ? 'attention' : 'non-compliant',
          inspection_date: inspectionDate,
          next_inspection_date: nextDate,
          ship_id: eq.ship_id,
          observations: `${t('categoryInspection.batchInspectionNote')}: ${selectedCategory$?.name}`,
          signature_data: signature,
          signed_at: new Date().toISOString(),
        };
      });

      // Batch insert all inspections at once
      const { data: createdInspections, error: inspError } = await supabase
        .from('inspections')
        .insert(inspectionRecords)
        .select();

      if (inspError) throw inspError;

      // Batch insert checklist items for all inspections if template exists
      if (defaultChecklist?.items && defaultChecklist.items.length > 0 && createdInspections) {
        const allChecklistItems = createdInspections.flatMap(insp => {
          const eqStatus = equipmentStatuses[insp.equipment_id] || 'compliant';
          return defaultChecklist.items!.map(item => ({
            inspection_id: insp.id,
            description: item.description,
            status: eqStatus === 'compliant' ? 'ok' : 
                    eqStatus === 'attention' ? 'attention' : 'fail',
            notes: '',
          }));
        });

        const { error: checklistError } = await supabase
          .from('inspection_checklist_items')
          .insert(allChecklistItems);

        if (checklistError) throw checklistError;
      }

      // Batch update equipment statuses
      const statusMapping: Record<string, string> = {
        compliant: 'active',
        attention: 'maintenance',
        'non-compliant': 'rejected',
      };

      // Group by status for batch updates
      const statusGroups = new Map<string, string[]>();
      for (const eq of selectedEquipments) {
        const eqStatus = equipmentStatuses[eq.id] || 'compliant';
        const equipStatus = statusMapping[eqStatus] || 'active';
        if (!statusGroups.has(equipStatus)) statusGroups.set(equipStatus, []);
        statusGroups.get(equipStatus)!.push(eq.id);
      }

      // Execute batch updates per status group
      await Promise.all(
        Array.from(statusGroups.entries()).map(([status, ids]) =>
          supabase
            .from('equipment')
            .update({
              status,
              last_inspection: inspectionDate,
              next_inspection: nextDate,
            })
            .in('id', ids)
        )
      );

      // Build results
      for (const eq of selectedEquipments) {
        results.push({
          equipment: eq,
          status: equipmentStatuses[eq.id] || 'compliant',
        });
      }

      // Invalidate queries once
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });

      setInspectionResults(results);
      setShowResultsDialog(true);
      setSelectedEquipmentIds(new Set());
      setEquipmentStatuses({});

      toast({
        title: t('categoryInspection.inspectionsRegistered'),
        description: `${results.length} ${t('categoryInspection.inspectedSuccessfully')}`,
      });
    } catch (error) {
      toast({
        title: t('categoryInspection.errorRegistering'),
        description: error instanceof Error ? error.message : t('common.error'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportPDF = async () => {
    if (inspectionResults.length === 0 || !fullProfile) return;

    await exportCategoryInspectionPDF({
      category: selectedCategory$!,
      ship: selectedShip$,
      results: inspectionResults,
      inspector: {
        name: fullProfile.full_name,
        position: fullProfile.position || undefined,
        email: fullProfile.email,
      },
      signatureData: signatureData || undefined,
      inspectionDate: new Date().toISOString().split('T')[0],
      branding,
    });

    toast({
      title: t('categoryInspection.reportExported'),
      description: t('categoryInspection.reportGeneratedSuccessfully'),
    });
  };

  const isLoading = categoriesLoading || equipmentLoading;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {t('categoryInspection.title')}
          </CardTitle>
          <CardDescription>
            {t('categoryInspection.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('categoryInspection.categoryLabel')}</label>
              <Select value={selectedCategory} onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedEquipmentIds(new Set());
                setSearchQuery('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={t('categoryInspection.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('categoryInspection.unitShipLabel')}
                {availableShips.length === 1 && !isAdmin && !isAdminMaster && (
                  <Badge variant="secondary" className="ml-2 text-xs">{t('categoryInspection.autoSelected')}</Badge>
                )}
              </label>
              <Select 
                value={selectedShip} 
                onValueChange={(value) => {
                  setSelectedShip(value);
                  setSelectedEquipmentIds(new Set());
                  setSearchQuery('');
                }}
                disabled={availableShips.length === 1 && !isAdmin && !isAdminMaster}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('categoryInspection.selectUnit')} />
                </SelectTrigger>
                <SelectContent>
                  {availableShips.map(ship => (
                    <SelectItem key={ship.id} value={ship.id}>
                      {ship.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableShips.length === 0 && !isAdmin && !isAdminMaster && (
                <p className="text-sm text-destructive">{t('categoryInspection.noUnitAssigned')}</p>
              )}
            </div>
          </div>

          {/* Search filter */}
          {selectedCategory && selectedShip && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('categoryInspection.filterEquipment')}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('categoryInspection.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Auto-sign indicator */}
          {userSignatureSettings?.auto_sign_inspections && userSignatureSettings?.default_signature && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary">
                {t('categoryInspection.autoSignatureEnabled')}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipment List */}
      {selectedCategory && selectedShip && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('categoryInspection.equipmentCategory')}</CardTitle>
                <CardDescription>
                  {filteredEquipment.length} {t('categoryInspection.equipmentFound')} • {selectedEquipmentIds.size} {t('categoryInspection.selected')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  disabled={filteredEquipment.length === 0}
                >
                  {isAllSelected ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      {t('categoryInspection.deselectAll')}
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      {t('categoryInspection.selectAll')}
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleStartInspection}
                  disabled={selectedEquipmentIds.size === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('categoryInspection.processing')}
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      {t('categoryInspection.launchInspection')} ({selectedEquipmentIds.size})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t('categoryInspection.noEquipmentFound')}</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>{t('categoryInspection.code')}</TableHead>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('categoryInspection.locationColumn')}</TableHead>
                      <TableHead>{t('equipmentTable.status')}</TableHead>
                      <TableHead>{t('categoryInspection.statusColumn')}</TableHead>
                      <TableHead>{t('equipmentDetail.lastInspection')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipment.map((eq) => (
                      <TableRow 
                        key={eq.id}
                        className={`hover:bg-muted/50 ${selectedEquipmentIds.has(eq.id) ? 'bg-primary/5' : ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedEquipmentIds.has(eq.id)}
                            onCheckedChange={() => handleSelectEquipment(eq.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{eq.internal_code}</TableCell>
                        <TableCell className="font-medium">{eq.name}</TableCell>
                        <TableCell>{eq.location}</TableCell>
                        <TableCell>
                          <Badge variant={
                            eq.status === 'active' ? 'default' :
                            eq.status === 'maintenance' ? 'secondary' :
                            'destructive'
                          }>
                          {eq.status === 'active' ? t('equipment.statusActive') :
                             eq.status === 'maintenance' ? t('equipment.statusMaintenance') :
                             eq.status === 'rejected' ? t('equipment.statusRejected') : eq.status}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {selectedEquipmentIds.has(eq.id) ? (
                            <Select
                              value={equipmentStatuses[eq.id] || 'compliant'}
                              onValueChange={(value) => handleStatusChange(eq.id, value as 'compliant' | 'attention' | 'non-compliant')}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compliant">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500" />
                                    {t('categoryInspection.compliant')}
                                  </span>
                                </SelectItem>
                                <SelectItem value="attention">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    {t('categoryInspection.attentionStatus')}
                                  </span>
                                </SelectItem>
                                <SelectItem value="non-compliant">
                                  <span className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {t('categoryInspection.nonCompliantStatus')}
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {eq.last_inspection ? formatDate(eq.last_inspection) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('categoryInspection.signInspection')}</DialogTitle>
            <DialogDescription className="space-y-2">
              <p>{t('categoryInspection.signatureRequired').replace('{{count}}', String(selectedEquipmentIds.size))}</p>
              <div className="flex flex-wrap gap-2 pt-2">
                {(() => {
                  const compliantCount = Array.from(selectedEquipmentIds).filter(id => (equipmentStatuses[id] || 'compliant') === 'compliant').length;
                  const attentionCount = Array.from(selectedEquipmentIds).filter(id => equipmentStatuses[id] === 'attention').length;
                  const nonCompliantCount = Array.from(selectedEquipmentIds).filter(id => equipmentStatuses[id] === 'non-compliant').length;
                  return (
                    <>
                      {compliantCount > 0 && <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">{compliantCount} {t('categoryInspection.compliant')}</Badge>}
                      {attentionCount > 0 && <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/30">{attentionCount} {t('categoryInspection.attentionStatus')}</Badge>}
                      {nonCompliantCount > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">{nonCompliantCount} {t('categoryInspection.nonCompliantStatus')}</Badge>}
                    </>
                  );
                })()}
              </div>
            </DialogDescription>
          </DialogHeader>
          <SignaturePad
            onSave={handleSignatureSave}
            onCancel={() => setShowSignatureDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {t('categoryInspection.inspectionResults')}
            </DialogTitle>
            <DialogDescription>
              {inspectionResults.length} {t('categoryInspection.equipmentInspected')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('common.category')}</p>
                <p className="font-medium">{selectedCategory$?.name}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('categoryInspection.unitShipLabel')}</p>
                <p className="font-medium">{selectedShip$?.name}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('common.date')}</p>
                <p className="font-medium">{formatDate(new Date().toISOString().split('T')[0])}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">{t('navigation.equipment')}</p>
                <p className="font-medium">{inspectionResults.length}</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('categoryInspection.code')}</TableHead>
                    <TableHead>{t('categoryInspection.equipmentName')}</TableHead>
                    <TableHead>{t('common.type')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspectionResults.map((result, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono">
                        {result.equipment.internal_code}
                      </TableCell>
                      <TableCell className="font-medium">
                        {result.equipment.name}
                      </TableCell>
                      <TableCell>{result.equipment.type}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="default" 
                          className={`gap-1 ${
                            result.status === 'compliant' ? 'bg-green-500 hover:bg-green-600' :
                            result.status === 'attention' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                            'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {result.status === 'compliant' ? (
                            <>
                              <Check className="h-3 w-3" />
                              {t('categoryInspection.compliant')}
                            </>
                          ) : result.status === 'attention' ? (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              {t('categoryInspection.attentionStatus')}
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="h-3 w-3" />
                              {t('categoryInspection.nonCompliantStatus')}
                            </>
                          )}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Signature Preview */}
            {signatureData && (
              <div className="border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">{t('inspections.inspectorSignature')}</p>
                <img 
                  src={signatureData} 
                  alt={t('inspections.inspectorSignature')} 
                  className="max-h-20 object-contain"
                />
                <p className="text-sm font-medium mt-2">{fullProfile?.full_name}</p>
                {fullProfile?.position && (
                  <p className="text-xs text-muted-foreground">{fullProfile.position}</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={handleExportPDF} className="gap-2">
              <FileText className="h-4 w-4" />
              {t('categoryInspection.downloadPDF')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}