import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, Package, Ship, Tag, ClipboardList, RefreshCw, Clock, Search, ChevronRight, Database, Plus, HardDrive, Image, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useOfflineSync, CachedEquipment, CachedCategory, CachedShip, CachedTemplate, PendingInspection, StorageStats } from '@/hooks/useOfflineSync';
import { InspectionFormDialog } from '@/components/equipment/InspectionFormDialog';
import type { Equipment } from '@/types/equipment';
import { OfflinePhotoPreview } from './OfflinePhotoPreview';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface OfflineData {
  equipment: CachedEquipment[];
  categories: CachedCategory[];
  ships: CachedShip[];
  templates: CachedTemplate[];
  timestamp: number | undefined;
}

export function OfflinePage() {
  const { t } = useTranslation();
  const { getOfflineData, isCacheAvailable, preCacheData, isOnline, getPendingInspections, pendingCount, cacheStats, refreshStats } = useOfflineSync();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<CachedEquipment | null>(null);
  const [inspectionDialogOpen, setInspectionDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for async data
  const [offlineData, setOfflineData] = useState<OfflineData | null>(null);
  const [pendingInspections, setPendingInspections] = useState<PendingInspection[]>([]);
  const [cacheAvailable, setCacheAvailable] = useState(false);

  // Load data on mount and when pendingCount changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [data, inspections, available] = await Promise.all([
          getOfflineData(),
          getPendingInspections(),
          isCacheAvailable(),
        ]);
        setOfflineData(data);
        setPendingInspections(inspections);
        setCacheAvailable(available);
      } catch (error) {
        console.error('Error loading offline data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [getOfflineData, getPendingInspections, isCacheAvailable, pendingCount]);

  const equipment = offlineData?.equipment || [];
  const categories = offlineData?.categories || [];
  const ships = offlineData?.ships || [];
  const templates = offlineData?.templates || [];
  const cacheTimestamp = offlineData?.timestamp;

  // Filter data based on search
  const filteredEquipment = useMemo(() => {
    if (!searchQuery) return equipment;
    const query = searchQuery.toLowerCase();
    return equipment.filter(
      e => e.name.toLowerCase().includes(query) || 
           e.internal_code.toLowerCase().includes(query) ||
           e.location.toLowerCase().includes(query) ||
           (e.short_code?.toLowerCase().includes(query))
    );
  }, [equipment, searchQuery]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-status-success/20 text-status-success border-status-success/30';
      case 'maintenance': return 'bg-status-warning/20 text-status-warning border-status-warning/30';
      case 'inactive': return 'bg-status-danger/20 text-status-danger border-status-danger/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || '-';
  };

  const getShipName = (shipId: string | null) => {
    if (!shipId) return '-';
    return ships.find(s => s.id === shipId)?.name || '-';
  };

  const handleRefreshCache = async () => {
    if (!isOnline) return;
    setIsRefreshing(true);
    await preCacheData();
    // Reload data after caching
    const data = await getOfflineData();
    setOfflineData(data);
    await refreshStats();
    setIsRefreshing(false);
  };

  const handleStartInspection = (equipment: CachedEquipment) => {
    setSelectedEquipment(equipment);
    setInspectionDialogOpen(true);
  };

  const handleInspectionSuccess = async () => {
    setSelectedEquipment(null);
    setInspectionDialogOpen(false);
    // Refresh pending inspections
    const inspections = await getPendingInspections();
    setPendingInspections(inspections);
  };

  // Calculate storage usage percentage (estimate based on 50MB limit for IndexedDB practical use)
  const storageUsagePercent = cacheStats ? Math.min((cacheStats.estimatedSizeMB / 50) * 100, 100) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cacheAvailable && !isOnline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
        <WifiOff className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t('offline.noCache')}</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          {t('offline.noCacheDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-3 rounded-xl",
            isOnline ? "bg-status-success/20" : "bg-status-warning/20"
          )}>
            {isOnline ? <Database className="h-6 w-6 text-status-success" /> : <WifiOff className="h-6 w-6 text-status-warning" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t('offline.cachedData')}</h1>
            <p className="text-sm text-muted-foreground">
              {isOnline ? t('offline.onlineStatus') : t('offline.offlineStatus')}
              {cacheTimestamp && (
                <span className="ml-2">
                  • {t('offline.lastUpdate')}: {format(new Date(cacheTimestamp), 'dd/MM HH:mm')}
                </span>
              )}
            </p>
          </div>
        </div>
        {isOnline && (
          <Button onClick={handleRefreshCache} disabled={isRefreshing} variant="outline">
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            {t('offline.refreshCache')}
          </Button>
        )}
      </div>

      {/* Storage Usage Indicator */}
      {cacheStats && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-primary/10">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{t('offline.storageUsage')}</span>
                  <span className="text-muted-foreground">
                    {cacheStats.estimatedSizeMB.toFixed(1)} MB
                  </span>
                </div>
                <Progress value={storageUsagePercent} className="h-2" />
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {cacheStats.equipmentCount} {t('offline.equipment')}
                  </span>
                  {cacheStats.photosCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Image className="h-3 w-3" />
                      {cacheStats.photosCount} {t('offline.photos')}
                    </span>
                  )}
                  {cacheStats.pendingActionsCount > 0 && (
                    <span className="flex items-center gap-1 text-status-warning">
                      <Clock className="h-3 w-3" />
                      {cacheStats.pendingActionsCount} {t('offline.pendingSync')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{equipment.length}</p>
              <p className="text-xs text-muted-foreground">{t('offline.equipment')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/50">
              <Ship className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ships.length}</p>
              <p className="text-xs text-muted-foreground">{t('offline.ships')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent">
              <Tag className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{categories.length}</p>
              <p className="text-xs text-muted-foreground">{t('offline.categories')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-xs text-muted-foreground">{t('offline.templates')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 lg:col-span-1">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              pendingCount > 0 ? "bg-status-warning/20" : "bg-status-success/20"
            )}>
              <Clock className={cn(
                "h-5 w-5",
                pendingCount > 0 ? "text-status-warning" : "text-status-success"
              )} />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">{t('offline.pendingSync')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="equipment" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="equipment" className="text-xs lg:text-sm">
            <Package className="h-4 w-4 mr-1.5 hidden lg:inline-block" />
            {t('offline.equipment')}
          </TabsTrigger>
          <TabsTrigger value="ships" className="text-xs lg:text-sm">
            <Ship className="h-4 w-4 mr-1.5 hidden lg:inline-block" />
            {t('offline.ships')}
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs lg:text-sm">
            <Tag className="h-4 w-4 mr-1.5 hidden lg:inline-block" />
            {t('offline.categories')}
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-xs lg:text-sm">
            <Clock className="h-4 w-4 mr-1.5 hidden lg:inline-block" />
            {t('offline.pendingTab')}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipment" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">{t('offline.cachedEquipment')}</CardTitle>
                  <CardDescription>
                    {t('offline.cachedEquipmentDesc')} ({filteredEquipment.length} / {equipment.length})
                  </CardDescription>
                </div>
                <div className="relative w-full lg:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('common.search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredEquipment.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t('common.noData')}</p>
                  ) : (
                    filteredEquipment.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                        onClick={() => handleStartInspection(item)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{item.name}</p>
                            <Badge variant="outline" className={cn("text-xs", getStatusColor(item.status))}>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span>{item.internal_code}</span>
                            {item.short_code && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{item.short_code}</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{getCategoryName(item.category_id)}</span>
                            <span>•</span>
                            <span>{getShipName(item.ship_id)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartInspection(item);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            {t('offline.inspect')}
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ships" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('offline.cachedShips')}</CardTitle>
              <CardDescription>{t('offline.cachedShipsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ships.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 col-span-full">{t('common.noData')}</p>
                ) : (
                  ships.map((ship) => (
                    <Card key={ship.id} className="bg-accent/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Ship className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{ship.name}</p>
                            {ship.code && (
                              <p className="text-xs text-muted-foreground">{ship.code}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('offline.cachedCategories')}</CardTitle>
              <CardDescription>{t('offline.cachedCategoriesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {categories.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 col-span-full">{t('common.noData')}</p>
                ) : (
                  categories.map((category) => (
                    <Card key={category.id} className="bg-accent/30">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-secondary/50">
                            <Tag className="h-5 w-5 text-secondary-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{category.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('offline.frequency')}: {category.inspection_frequency}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('offline.pendingInspectionsTitle')}</CardTitle>
              <CardDescription>{t('offline.pendingInspectionsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingInspections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="p-3 rounded-full bg-status-success/20 mb-4">
                    <Clock className="h-6 w-6 text-status-success" />
                  </div>
                  <p className="font-medium">{t('offline.noPending')}</p>
                  <p className="text-sm text-muted-foreground">{t('offline.noPendingDesc')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingInspections.map((inspection) => (
                    <div
                      key={inspection.id}
                      className="p-4 rounded-lg border bg-status-warning/5 border-status-warning/20"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-status-warning/20">
                            <ClipboardList className="h-5 w-5 text-status-warning" />
                          </div>
                          <div>
                            <p className="font-medium">{inspection.equipment_name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{inspection.equipment_code}</span>
                              <span>•</span>
                              <span>{format(new Date(inspection.timestamp), 'dd/MM HH:mm')}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          inspection.status === 'compliant' 
                            ? "bg-status-success/20 text-status-success border-status-success/30"
                            : inspection.status === 'attention'
                              ? "bg-status-warning/20 text-status-warning border-status-warning/30"
                              : "bg-status-danger/20 text-status-danger border-status-danger/30"
                        )}>
                          {inspection.status}
                        </Badge>
                      </div>
                      
                      {/* Photo preview section */}
                      {inspection.photos && inspection.photos.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-status-warning/20">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Image className="h-4 w-4" />
                              <span>{t('offline.pendingPhotos')} ({inspection.photos.length})</span>
                            </div>
                            <OfflinePhotoPreview 
                              inspectionId={inspection.id} 
                              photoIds={inspection.photos}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Inspection Dialog - uses the unified form */}
      {selectedEquipment && (
        <InspectionFormDialog
          open={inspectionDialogOpen}
          onOpenChange={setInspectionDialogOpen}
          equipment={{
            id: selectedEquipment.id,
            internalCode: selectedEquipment.internal_code,
            name: selectedEquipment.name,
            type: '',
            categoryId: selectedEquipment.category_id,
            categoryName: categories.find(c => c.id === selectedEquipment.category_id)?.name || '',
            manufacturer: '',
            model: '',
            serialNumber: selectedEquipment.serial_number,
            manufacturingDate: '',
            acquisitionDate: '',
            expiryDate: '',
            certificateExpiry: '',
            location: selectedEquipment.location,
            unit: '',
            status: selectedEquipment.status as any,
            lastInspection: '',
            nextInspection: '',
          } as Equipment}
          onSuccess={handleInspectionSuccess}
        />
      )}
    </div>
  );
}
