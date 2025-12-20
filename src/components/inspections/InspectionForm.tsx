import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ClipboardCheck, 
  User, 
  Calendar,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Camera,
  Search,
  ChevronDown,
  ChevronUp,
  QrCode,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTechniciansAndAdmins } from '@/hooks/useProfiles';
import { useCreateInspection } from '@/hooks/useInspections';
import { useEquipment, type EquipmentWithCategory } from '@/hooks/useEquipment';
import { useAuth } from '@/contexts/AuthContext';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { QRCodeScannerDialog } from '@/components/equipment/QRCodeScannerDialog';

const inspectionSchema = z.object({
  equipmentId: z.string().min(1, 'Selecione o equipamento'),
  inspectorId: z.string().min(1, 'Selecione o inspetor responsável'),
  inspectionDate: z.string().min(1, 'Data é obrigatória'),
  observations: z.string().optional(),
  recommendations: z.string().optional(),
  nextInspectionDate: z.string().optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;

interface ChecklistItem {
  id: string;
  description: string;
  status: 'pending' | 'ok' | 'attention' | 'fail';
  notes: string;
  required: boolean;
}

const getChecklistForCategory = (categoryId: string): ChecklistItem[] => {
  const baseChecklist: ChecklistItem[] = [
    { id: '1', description: 'Equipamento está acessível e desobstruído', status: 'pending', notes: '', required: true },
    { id: '2', description: 'Identificação/etiqueta legível e visível', status: 'pending', notes: '', required: true },
    { id: '3', description: 'Sem sinais de corrosão ou danos externos', status: 'pending', notes: '', required: true },
    { id: '4', description: 'Lacre de segurança íntegro', status: 'pending', notes: '', required: true },
    { id: '5', description: 'Data de validade dentro do prazo', status: 'pending', notes: '', required: true },
  ];

  const extintorChecklist: ChecklistItem[] = [
    ...baseChecklist,
    { id: '6', description: 'Manômetro na faixa verde (pressurizado)', status: 'pending', notes: '', required: true },
    { id: '7', description: 'Mangueira sem rachaduras ou obstruções', status: 'pending', notes: '', required: true },
    { id: '8', description: 'Gatilho e trava funcionando corretamente', status: 'pending', notes: '', required: true },
    { id: '9', description: 'Suporte de fixação em bom estado', status: 'pending', notes: '', required: false },
    { id: '10', description: 'Sinalização de localização visível', status: 'pending', notes: '', required: false },
  ];

  const scbaChecklist: ChecklistItem[] = [
    ...baseChecklist,
    { id: '6', description: 'Cilindro com pressão adequada', status: 'pending', notes: '', required: true },
    { id: '7', description: 'Máscara facial sem danos ou rachaduras', status: 'pending', notes: '', required: true },
    { id: '8', description: 'Válvula de demanda funcionando', status: 'pending', notes: '', required: true },
    { id: '9', description: 'Correias e tirantes em bom estado', status: 'pending', notes: '', required: true },
    { id: '10', description: 'Alarme de baixa pressão funcional', status: 'pending', notes: '', required: true },
    { id: '11', description: 'Teste de vedação realizado', status: 'pending', notes: '', required: true },
  ];

  if (categoryId === 'cat-1') return extintorChecklist;
  if (categoryId === 'cat-3') return scbaChecklist;
  return baseChecklist;
};

interface InspectionFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  preSelectedEquipmentId?: string | null;
}

export function InspectionForm({ onSuccess, onCancel, preSelectedEquipmentId }: InspectionFormProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithCategory | null>(null);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [observationsOpen, setObservationsOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [equipmentSearchTerm, setEquipmentSearchTerm] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  const { data: equipment = [], isLoading: equipmentLoading } = useEquipment();
  const { data: inspectors = [], isLoading: inspectorsLoading } = useTechniciansAndAdmins();
  const createInspection = useCreateInspection();

  // Filter equipment based on search term - prioritize code matches
  const filteredEquipment = useMemo(() => {
    if (!equipmentSearchTerm.trim()) return equipment;
    
    const term = equipmentSearchTerm.toLowerCase().trim();
    
    // First, find exact code matches
    const exactCodeMatches = equipment.filter(e => 
      e.internal_code.toLowerCase() === term
    );
    
    // Then, find partial code matches
    const partialCodeMatches = equipment.filter(e => 
      e.internal_code.toLowerCase().includes(term) &&
      !exactCodeMatches.includes(e)
    );
    
    // Finally, find name/location matches
    const otherMatches = equipment.filter(e => 
      (e.name.toLowerCase().includes(term) || 
       e.location.toLowerCase().includes(term) ||
       e.serial_number?.toLowerCase().includes(term)) &&
      !exactCodeMatches.includes(e) &&
      !partialCodeMatches.includes(e)
    );
    
    return [...exactCodeMatches, ...partialCodeMatches, ...otherMatches];
  }, [equipment, equipmentSearchTerm]);

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      equipmentId: '',
      inspectorId: user?.id || '',
      inspectionDate: new Date().toISOString().split('T')[0],
      observations: '',
      recommendations: '',
      nextInspectionDate: '',
    },
  });

  useEffect(() => {
    if (user?.id) {
      form.setValue('inspectorId', user.id);
    }
  }, [user, form]);

  // Pre-select equipment from QR code scan
  useEffect(() => {
    if (preSelectedEquipmentId && equipment.length > 0 && !selectedEquipment) {
      const equip = equipment.find(e => e.id === preSelectedEquipmentId);
      if (equip) {
        setSelectedEquipment(equip);
        form.setValue('equipmentId', equip.id);
      }
    }
  }, [preSelectedEquipmentId, equipment, selectedEquipment, form]);

  useEffect(() => {
    if (selectedEquipment) {
      setChecklist(getChecklistForCategory(selectedEquipment.category_id));
    }
  }, [selectedEquipment]);

  const updateChecklistItem = (itemId: string, field: 'status' | 'notes', value: string) => {
    setChecklist(prev => prev.map(item => 
      item.id === itemId ? { ...item, [field]: value } : item
    ));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadedPhotos(prev => [...prev, ...Array.from(files)]);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusCounts = () => {
    const counts = { ok: 0, attention: 0, fail: 0, pending: 0 };
    checklist.forEach(item => {
      counts[item.status]++;
    });
    return counts;
  };

  const calculateOverallStatus = (): 'compliant' | 'attention' | 'non-compliant' => {
    const counts = getStatusCounts();
    if (counts.fail > 0) return 'non-compliant';
    if (counts.attention > 0) return 'attention';
    if (counts.pending > 0) return 'attention';
    return 'compliant';
  };

  const handleEquipmentSelect = (equip: EquipmentWithCategory) => {
    setSelectedEquipment(equip);
    form.setValue('equipmentId', equip.id);
    setEquipmentOpen(false);
    setEquipmentSearchTerm('');
  };

  const handleQRScan = (equipmentId: string) => {
    const equip = equipment.find(e => e.id === equipmentId);
    if (equip) {
      handleEquipmentSelect(equip);
      toast({
        title: 'Equipamento Encontrado',
        description: `${equip.internal_code} - ${equip.name}`,
      });
    } else {
      toast({
        title: 'Equipamento Não Encontrado',
        description: 'O QR code não corresponde a nenhum equipamento cadastrado.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: InspectionFormData) => {
    if (!selectedEquipment) return;
    
    const pendingItems = checklist.filter(item => item.status === 'pending' && item.required);
    if (pendingItems.length > 0) {
      toast({
        title: "Checklist Incompleto",
        description: `Existem ${pendingItems.length} item(s) obrigatório(s) não avaliados.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      await createInspection.mutateAsync({
        inspection: {
          equipment_id: data.equipmentId,
          inspector_id: data.inspectorId,
          inspection_date: data.inspectionDate,
          status: calculateOverallStatus(),
          observations: data.observations || null,
          recommendations: data.recommendations || null,
          next_inspection_date: data.nextInspectionDate || null,
        },
        checklistItems: checklist.map(item => ({
          description: item.description,
          status: item.status,
          notes: item.notes,
        })),
        photos: uploadedPhotos,
      });
      
      form.reset();
      setChecklist([]);
      setUploadedPhotos([]);
      setSelectedEquipment(null);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusCounts = getStatusCounts();

  return (
    <>
      <Card className="border-primary/20 flex flex-col min-h-0 max-h-[calc(100vh-200px)]">
        <CardHeader className="pb-4 flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Nova Inspeção
          </CardTitle>
          <CardDescription>
            Preencha os dados para registrar uma nova inspeção
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden min-h-0">
          <ScrollArea className="h-full min-h-0 pr-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Equipment Section with QR Scanner */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <FormLabel className="flex items-center gap-2">
                      <Search className="h-4 w-4" />
                      Equipamento *
                    </FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setQrScannerOpen(true)}
                    >
                      <QrCode className="h-4 w-4" />
                      Escanear QR
                    </Button>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "justify-between w-full",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={equipmentLoading}
                              >
                                {selectedEquipment 
                                  ? `${selectedEquipment.internal_code} - ${selectedEquipment.name}`
                                  : equipmentLoading 
                                    ? 'Carregando...' 
                                    : 'Selecione o equipamento'}
                                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] sm:w-[400px] p-0 bg-popover border border-border shadow-lg z-50" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput 
                                placeholder="Buscar por código, nome ou localização..." 
                                value={equipmentSearchTerm}
                                onValueChange={setEquipmentSearchTerm}
                              />
                              <CommandList className="max-h-[300px]">
                                <CommandEmpty>
                                  <div className="py-6 text-center text-sm">
                                    <p>Nenhum equipamento encontrado.</p>
                                    <p className="text-muted-foreground">Tente buscar pelo código interno.</p>
                                  </div>
                                </CommandEmpty>
                                <CommandGroup>
                                  {filteredEquipment.slice(0, 50).map((equip) => (
                                    <CommandItem
                                      key={equip.id}
                                      value={equip.id}
                                      onSelect={() => handleEquipmentSelect(equip)}
                                      className="cursor-pointer"
                                    >
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          <span className="text-primary">{equip.internal_code}</span>
                                          {' - '}{equip.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {equip.categories?.name} • {equip.location}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                  {filteredEquipment.length > 50 && (
                                    <div className="py-2 px-3 text-xs text-muted-foreground text-center">
                                      Mostrando 50 de {filteredEquipment.length} resultados. Refine sua busca.
                                    </div>
                                  )}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Inspector and Date Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              <FormField
                control={form.control}
                name="inspectorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Inspetor *
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={inspectorsLoading}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={inspectorsLoading ? 'Carregando...' : 'Selecione'} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border border-border shadow-lg z-50">
                        {inspectors.map((inspector) => (
                          <SelectItem key={inspector.user_id} value={inspector.user_id}>
                            <span>{inspector.full_name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inspectionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Data *
                    </FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Checklist Section */}
            {selectedEquipment && checklist.length > 0 && (
              <Collapsible open={checklistOpen} onOpenChange={setChecklistOpen}>
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">Checklist de Inspeção</h3>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 text-sm">
                          <span className="flex items-center gap-1 text-status-success">
                            <CheckCircle2 className="h-4 w-4" />
                            {statusCounts.ok}
                          </span>
                          <span className="flex items-center gap-1 text-status-warning">
                            <AlertTriangle className="h-4 w-4" />
                            {statusCounts.attention}
                          </span>
                          <span className="flex items-center gap-1 text-status-danger">
                            <XCircle className="h-4 w-4" />
                            {statusCounts.fail}
                          </span>
                        </div>
                        {checklistOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Separator />
                    <div className="p-4 space-y-3">
                      {checklist.map((item, index) => (
                        <div 
                          key={item.id}
                          className={cn(
                            'p-4 rounded-lg border transition-colors',
                            item.status === 'ok' && 'border-status-success/30 bg-status-success/5',
                            item.status === 'attention' && 'border-status-warning/30 bg-status-warning/5',
                            item.status === 'fail' && 'border-status-danger/30 bg-status-danger/5',
                            item.status === 'pending' && 'border-border bg-card',
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-sm">
                                  {item.description}
                                  {item.required && <span className="text-destructive ml-1">*</span>}
                                </p>
                              </div>

                              <RadioGroup
                                value={item.status}
                                onValueChange={(value) => updateChecklistItem(item.id, 'status', value)}
                                className="flex flex-wrap items-center gap-4"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="ok" id={`${item.id}-ok`} />
                                  <Label 
                                    htmlFor={`${item.id}-ok`}
                                    className="flex items-center gap-1 text-sm cursor-pointer text-status-success"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Conforme
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="attention" id={`${item.id}-attention`} />
                                  <Label 
                                    htmlFor={`${item.id}-attention`}
                                    className="flex items-center gap-1 text-sm cursor-pointer text-status-warning"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                    Atenção
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="fail" id={`${item.id}-fail`} />
                                  <Label 
                                    htmlFor={`${item.id}-fail`}
                                    className="flex items-center gap-1 text-sm cursor-pointer text-status-danger"
                                  >
                                    <XCircle className="h-4 w-4" />
                                    Não Conforme
                                  </Label>
                                </div>
                              </RadioGroup>

                              {(item.status === 'attention' || item.status === 'fail') && (
                                <Input
                                  placeholder="Descreva o problema encontrado..."
                                  value={item.notes}
                                  onChange={(e) => updateChecklistItem(item.id, 'notes', e.target.value)}
                                  className="text-sm"
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            )}

            {/* Photos Section */}
            <Collapsible open={photosOpen} onOpenChange={setPhotosOpen}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Camera className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Evidências Fotográficas</h3>
                      {uploadedPhotos.length > 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                          {uploadedPhotos.length}
                        </span>
                      )}
                    </div>
                    {photosOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors mb-4">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                        id="photo-upload-form"
                      />
                      <label 
                        htmlFor="photo-upload-form"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        <Camera className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para adicionar fotos
                        </span>
                      </label>
                    </div>

                    {uploadedPhotos.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {uploadedPhotos.map((photo, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Foto ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removePhoto(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Observations Section */}
            <Collapsible open={observationsOpen} onOpenChange={setObservationsOpen}>
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Observações e Recomendações</h3>
                    </div>
                    {observationsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Separator />
                  <div className="p-4 space-y-4">
                    <FormField
                      control={form.control}
                      name="observations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Observações Gerais</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descreva observações relevantes sobre a inspeção..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recommendations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recomendações</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Inclua recomendações ou ações corretivas necessárias..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nextInspectionDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Próxima Inspeção
                          </FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              <Button 
                type="submit" 
                disabled={isSubmitting || !selectedEquipment}
                className="gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Registrar Inspeção
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* QR Code Scanner Dialog */}
      <QRCodeScannerDialog
        open={qrScannerOpen}
        onOpenChange={setQrScannerOpen}
        onScan={handleQRScan}
      />
    </>
  );
}
