import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  ClipboardCheck, 
  User, 
  Calendar,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Camera,
  FileText,
} from 'lucide-react';
import { Equipment } from '@/types/equipment';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const inspectionSchema = z.object({
  inspectorId: z.string().min(1, 'Selecione o inspetor responsável'),
  inspectionDate: z.string().min(1, 'Data é obrigatória'),
  overallStatus: z.enum(['compliant', 'attention', 'non-compliant']),
  observations: z.string().optional(),
  recommendations: z.string().optional(),
  nextInspectionDate: z.string().optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;

interface InspectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

interface ChecklistItem {
  id: string;
  description: string;
  status: 'pending' | 'ok' | 'attention' | 'fail';
  notes: string;
  required: boolean;
}

const mockInspectors = [
  { id: 'insp-1', name: 'Carlos Silva', role: 'Técnico de Segurança', cert: 'NR-13, NR-35' },
  { id: 'insp-2', name: 'Maria Santos', role: 'Engenheira de Segurança', cert: 'CREA-RJ' },
  { id: 'insp-3', name: 'João Oliveira', role: 'Técnico de Manutenção', cert: 'NR-10, NR-12' },
  { id: 'insp-4', name: 'Ana Costa', role: 'Inspetora Certificada', cert: 'ISO 9001' },
];

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

export function InspectionFormDialog({ 
  open, 
  onOpenChange, 
  equipment 
}: InspectionFormDialogProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      inspectorId: '',
      inspectionDate: new Date().toISOString().split('T')[0],
      overallStatus: 'compliant',
      observations: '',
      recommendations: '',
      nextInspectionDate: '',
    },
  });

  // Initialize checklist when equipment changes
  useState(() => {
    if (equipment) {
      setChecklist(getChecklistForCategory(equipment.categoryId));
    }
  });

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

  const calculateOverallStatus = () => {
    const counts = getStatusCounts();
    if (counts.fail > 0) return 'non-compliant';
    if (counts.attention > 0) return 'attention';
    if (counts.pending > 0) return 'attention';
    return 'compliant';
  };

  const onSubmit = async (data: InspectionFormData) => {
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
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    const inspector = mockInspectors.find(i => i.id === data.inspectorId);
    
    toast({
      title: "Inspeção Registrada",
      description: `Inspeção do equipamento ${equipment?.internalCode} registrada com sucesso por ${inspector?.name}.`,
    });
    
    setIsSubmitting(false);
    onOpenChange(false);
    form.reset();
    setChecklist([]);
    setUploadedPhotos([]);
  };

  const statusCounts = getStatusCounts();

  if (!equipment) return null;

  // Initialize checklist on open
  if (checklist.length === 0) {
    setChecklist(getChecklistForCategory(equipment.categoryId));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col bg-card border border-border">
        <DialogHeader className="pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Registrar Inspeção
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            <span>
              <strong>{equipment.internalCode}</strong> - {equipment.name}
            </span>
            <span className="text-xs px-2 py-1 bg-muted rounded">
              {equipment.categoryName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-hidden flex flex-col">
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                {/* Inspector and Date Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="inspectorId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Inspetor Responsável *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o inspetor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-popover border border-border shadow-lg z-50">
                            {mockInspectors.map((inspector) => (
                              <SelectItem key={inspector.id} value={inspector.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{inspector.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {inspector.role} • {inspector.cert}
                                  </span>
                                </div>
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
                          Data da Inspeção *
                        </FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Checklist Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Checklist de Inspeção</h3>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                        {statusCounts.ok} OK
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-4 w-4 text-status-warning" />
                        {statusCounts.attention} Atenção
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="h-4 w-4 text-status-danger" />
                        {statusCounts.fail} Falha
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
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
                              className="flex items-center gap-4"
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
                </div>

                <Separator />

                {/* Photo Evidence Section */}
                <div>
                  <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Evidências Fotográficas
                  </h3>

                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors mb-4">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      id="photo-upload"
                    />
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="font-medium text-sm">Adicionar Fotos</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Clique ou arraste imagens
                      </p>
                    </label>
                  </div>

                  {uploadedPhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {uploadedPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                            <img
                              src={URL.createObjectURL(photo)}
                              alt={`Evidência ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
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

                <Separator />

                {/* Observations Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="observations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Observações Gerais</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Observações sobre a inspeção..."
                            rows={4}
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
                        <FormLabel>Recomendações / Ações Corretivas</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Ações necessárias..."
                            rows={4}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="nextInspectionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Próxima Inspeção Programada</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="max-w-xs" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Overall Status Summary */}
                <div className={cn(
                  'p-4 rounded-lg border',
                  calculateOverallStatus() === 'compliant' && 'border-status-success bg-status-success/10',
                  calculateOverallStatus() === 'attention' && 'border-status-warning bg-status-warning/10',
                  calculateOverallStatus() === 'non-compliant' && 'border-status-danger bg-status-danger/10',
                )}>
                  <div className="flex items-center gap-3">
                    {calculateOverallStatus() === 'compliant' && (
                      <CheckCircle2 className="h-6 w-6 text-status-success" />
                    )}
                    {calculateOverallStatus() === 'attention' && (
                      <AlertTriangle className="h-6 w-6 text-status-warning" />
                    )}
                    {calculateOverallStatus() === 'non-compliant' && (
                      <XCircle className="h-6 w-6 text-status-danger" />
                    )}
                    <div>
                      <p className="font-semibold">
                        Status Geral: {' '}
                        {calculateOverallStatus() === 'compliant' && 'CONFORME'}
                        {calculateOverallStatus() === 'attention' && 'ATENÇÃO NECESSÁRIA'}
                        {calculateOverallStatus() === 'non-compliant' && 'NÃO CONFORME'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {statusCounts.ok} conformes • {statusCounts.attention} com atenção • {statusCounts.fail} não conformes
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Salvar Rascunho
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" />
                      Finalizar Inspeção
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
