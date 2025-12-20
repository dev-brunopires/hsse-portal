import { useState, useMemo } from 'react';
import { 
  Layers, 
  Check, 
  CheckSquare, 
  Square, 
  Loader2, 
  FileText,
  ClipboardCheck,
  AlertTriangle,
  Ship
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
import { useCreateInspection } from '@/hooks/useInspections';
import { useUserSignature } from '@/hooks/useUserSignature';
import { useAuth } from '@/contexts/AuthContext';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useToast } from '@/hooks/use-toast';
import { SignaturePad } from './SignaturePad';
import { exportCategoryInspectionPDF } from '@/utils/exportCategoryInspection';
import { formatDate } from '@/utils/dateFormat';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface CategoryInspectionResult {
  equipment: EquipmentWithCategory;
  status: 'compliant' | 'attention' | 'non-compliant';
}

export function CategoryInspectionTab() {
  const { user } = useAuth();
  const { selectedShipId } = useShipFilter();
  const { toast } = useToast();
  
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
  const { data: ships = [] } = useShips();
  const { data: userSignatureSettings } = useUserSignature();
  const createInspection = useCreateInspection();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedShip, setSelectedShip] = useState<string>(selectedShipId || '');
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [inspectionResults, setInspectionResults] = useState<CategoryInspectionResult[]>([]);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  // Filter equipment by category and ship
  const filteredEquipment = useMemo(() => {
    return equipment.filter(eq => {
      const matchesCategory = !selectedCategory || eq.category_id === selectedCategory;
      const matchesShip = !selectedShip || eq.ship_id === selectedShip;
      return matchesCategory && matchesShip;
    });
  }, [equipment, selectedCategory, selectedShip]);

  const selectedCategory$ = categories.find(c => c.id === selectedCategory);
  const selectedShip$ = ships.find(s => s.id === selectedShip);

  const isAllSelected = filteredEquipment.length > 0 && 
    filteredEquipment.every(eq => selectedEquipmentIds.has(eq.id));

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEquipmentIds(new Set());
    } else {
      setSelectedEquipmentIds(new Set(filteredEquipment.map(eq => eq.id)));
    }
  };

  const handleSelectEquipment = (equipmentId: string) => {
    const newSet = new Set(selectedEquipmentIds);
    if (newSet.has(equipmentId)) {
      newSet.delete(equipmentId);
    } else {
      newSet.add(equipmentId);
    }
    setSelectedEquipmentIds(newSet);
  };

  const handleStartInspection = () => {
    if (selectedEquipmentIds.size === 0) {
      toast({
        title: 'Nenhum equipamento selecionado',
        description: 'Selecione pelo menos um equipamento para inspecionar.',
        variant: 'destructive',
      });
      return;
    }

    // Check if user has auto-sign enabled
    if (userSignatureSettings?.auto_sign_inspections && userSignatureSettings?.default_signature) {
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

      for (const eq of selectedEquipments) {
        await createInspection.mutateAsync({
          inspection: {
            equipment_id: eq.id,
            inspector_id: user.id,
            status: 'compliant',
            inspection_date: new Date().toISOString().split('T')[0],
            observations: `Inspeção em lote por categoria: ${selectedCategory$?.name}`,
            signature_data: signature,
            signed_at: new Date().toISOString(),
          },
          checklistItems: [],
          photos: [],
        });

        results.push({
          equipment: eq,
          status: 'compliant',
        });
      }

      setInspectionResults(results);
      setShowResultsDialog(true);
      setSelectedEquipmentIds(new Set());

      toast({
        title: 'Inspeções Registradas',
        description: `${results.length} equipamento(s) inspecionado(s) com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao registrar inspeções',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
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
    });

    toast({
      title: 'Relatório Exportado',
      description: 'O relatório foi gerado com sucesso.',
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
            Inspeção por Categoria
          </CardTitle>
          <CardDescription>
            Selecione uma categoria e um navio para inspecionar todos os equipamentos de uma vez
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={selectedCategory} onValueChange={(value) => {
                setSelectedCategory(value);
                setSelectedEquipmentIds(new Set());
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
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
              <label className="text-sm font-medium">Unidade/Navio</label>
              <Select value={selectedShip} onValueChange={(value) => {
                setSelectedShip(value);
                setSelectedEquipmentIds(new Set());
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma unidade" />
                </SelectTrigger>
                <SelectContent>
                  {ships.map(ship => (
                    <SelectItem key={ship.id} value={ship.id}>
                      {ship.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      {selectedCategory && selectedShip && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Equipamentos da Categoria</CardTitle>
                <CardDescription>
                  {filteredEquipment.length} equipamento(s) encontrado(s) • {selectedEquipmentIds.size} selecionado(s)
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
                      Desmarcar Todos
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-4 w-4 mr-2" />
                      Selecionar Todos
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
                      Processando...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Lançar Conforme ({selectedEquipmentIds.size})
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
                <p>Nenhum equipamento encontrado para esta categoria e unidade.</p>
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
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Localização</TableHead>
                      <TableHead>Status Atual</TableHead>
                      <TableHead>Última Inspeção</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEquipment.map((eq) => (
                      <TableRow 
                        key={eq.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSelectEquipment(eq.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedEquipmentIds.has(eq.id)}
                            onCheckedChange={() => handleSelectEquipment(eq.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono">{eq.internal_code}</TableCell>
                        <TableCell className="font-medium">{eq.name}</TableCell>
                        <TableCell>{eq.type}</TableCell>
                        <TableCell>{eq.location}</TableCell>
                        <TableCell>
                          <Badge variant={
                            eq.status === 'active' ? 'default' :
                            eq.status === 'maintenance' ? 'secondary' :
                            'destructive'
                          }>
                            {eq.status === 'active' ? 'Ativo' :
                             eq.status === 'maintenance' ? 'Manutenção' :
                             eq.status === 'rejected' ? 'Reprovado' : eq.status}
                          </Badge>
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
            <DialogTitle>Assinatura do Inspetor</DialogTitle>
            <DialogDescription>
              Assine abaixo para confirmar a inspeção de {selectedEquipmentIds.size} equipamento(s)
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
              Inspeção Concluída
            </DialogTitle>
            <DialogDescription>
              Resumo da inspeção em lote realizada
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Categoria</p>
                <p className="font-medium">{selectedCategory$?.name}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Unidade</p>
                <p className="font-medium">{selectedShip$?.name}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium">{formatDate(new Date().toISOString().split('T')[0])}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Equipamentos</p>
                <p className="font-medium">{inspectionResults.length}</p>
              </div>
            </div>

            {/* Results Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
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
                        <Badge variant="default" className="gap-1">
                          <Check className="h-3 w-3" />
                          Conforme
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
                <p className="text-sm text-muted-foreground mb-2">Assinatura do Inspetor</p>
                <img 
                  src={signatureData} 
                  alt="Assinatura" 
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
              Fechar
            </Button>
            <Button onClick={handleExportPDF} className="gap-2">
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
