import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ResponsiveDialog, ResponsiveDialogBody, ResponsiveDialogFooter } from '@/components/ui/responsive-dialog';
import {
  Form,
  FormControl,
  FormDescription,
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
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, FolderOpen } from 'lucide-react';
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useCategories';
import { useCreateChecklistTemplate, useUpdateChecklistTemplate, useDefaultChecklistTemplate } from '@/hooks/useChecklistTemplates';
import { categoryIconOptions, getCategoryIcon } from '@/utils/categoryIcons';
import { ChecklistItemsEditor, type ChecklistItemData } from './ChecklistItemsEditor';

type BlockingExpiryKey =
  | 'certificate_expiry'
  | 'expiry_date'
  | 'next_hydrostatic_test'
  | 'next_calibration';

type CategoryFormData = {
  name: string;
  description?: string;
  icon: string;
  inspection_frequency: string;
  blocking_expiries: BlockingExpiryKey[];
};

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  category?: Category | null;
}

export function CategoryFormDialog({ open, onOpenChange, mode, category }: CategoryFormDialogProps) {
  const { t } = useTranslation();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const createChecklistTemplate = useCreateChecklistTemplate();
  const updateChecklistTemplate = useUpdateChecklistTemplate();
  
  // Fetch existing default template when editing
  const { data: defaultTemplate } = useDefaultChecklistTemplate(category?.id);
  
  // State for checklist items
  const [checklistItems, setChecklistItems] = useState<ChecklistItemData[]>([]);

  const categorySchema = z.object({
    name: z.string().min(2, t('validation.nameMinLength')),
    description: z.string().optional(),
    icon: z.string().min(1, t('validation.selectIcon')),
    inspection_frequency: z.string().min(1, t('validation.selectFrequency')),
    blocking_expiries: z.array(
      z.enum(['certificate_expiry', 'expiry_date', 'next_hydrostatic_test', 'next_calibration'])
    ).default([]),
  });

  const frequencyOptions = [
    { value: 'monthly', label: t('categoryForm.monthly') },
    { value: 'quarterly', label: t('categoryForm.quarterly') },
    { value: 'semiannual', label: t('categoryForm.semiannual') },
    { value: 'annual', label: t('categoryForm.annual') },
    { value: 'custom', label: t('categoryForm.custom') },
  ];

  const blockingExpiryOptions: { value: BlockingExpiryKey; label: string }[] = [
    { value: 'certificate_expiry', label: t('categoryForm.blockingCertificate', 'Validade do certificado') },
    { value: 'expiry_date', label: t('categoryForm.blockingEquipment', 'Validade do equipamento') },
    { value: 'next_hydrostatic_test', label: t('categoryForm.blockingHydrostatic', 'Próximo teste hidrostático') },
    { value: 'next_calibration', label: t('categoryForm.blockingCalibration', 'Próxima calibração') },
  ];

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      icon: 'package',
      inspection_frequency: 'monthly',
      blocking_expiries: ['certificate_expiry', 'expiry_date'],
    },
  });

  useEffect(() => {
    if (open && category && mode === 'edit') {
      const existing: BlockingExpiryKey[] = Array.isArray((category as any).blocking_expiries)
        ? ((category as any).blocking_expiries as BlockingExpiryKey[])
        : (['certificate_expiry', 'expiry_date'] as BlockingExpiryKey[]);
      form.reset({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'package',
        inspection_frequency: category.inspection_frequency,
        blocking_expiries: existing,
      });
      // Load existing checklist items from default template
      if (defaultTemplate?.items) {
        setChecklistItems(defaultTemplate.items.map(i => ({
          id: i.id,
          description: i.description,
          is_required: i.is_required,
        })));
      } else {
        setChecklistItems([]);
      }
    } else if (open && mode === 'create') {
      form.reset({
        name: '',
        description: '',
        icon: 'package',
        inspection_frequency: 'monthly',
        blocking_expiries: ['certificate_expiry', 'expiry_date'],
      });
      setChecklistItems([]);
    }
  }, [open, category, mode, form, defaultTemplate]);

  const onSubmit = async (data: CategoryFormData) => {
    if (mode === 'create') {
      // Create category first
      const newCategory = await createCategory.mutateAsync({
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
        blocking_expiries: data.blocking_expiries as any,
      });
      
      // Then create default checklist template if items exist
      if (checklistItems.length > 0 && newCategory) {
        await createChecklistTemplate.mutateAsync({
          template: {
            category_id: newCategory.id,
            name: t('checklistTemplates.defaultTemplateName'),
            is_default: true,
          },
          items: checklistItems,
        });
      }
    } else if (category) {
      // Update category
      await updateCategory.mutateAsync({
        id: category.id,
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
        blocking_expiries: data.blocking_expiries as any,
      });
      
      // Update or create default checklist template
      if (defaultTemplate) {
        await updateChecklistTemplate.mutateAsync({
          id: defaultTemplate.id,
          template: {},
          items: checklistItems,
        });
      } else if (checklistItems.length > 0) {
        await createChecklistTemplate.mutateAsync({
          template: {
            category_id: category.id,
            name: t('checklistTemplates.defaultTemplateName'),
            is_default: true,
          },
          items: checklistItems,
        });
      }
    }
    onOpenChange(false);
  };

  const isSubmitting = createCategory.isPending || updateCategory.isPending || 
    createChecklistTemplate.isPending || updateChecklistTemplate.isPending;
  const selectedIcon = categoryIconOptions.find(i => i.value === form.watch('icon'));
  const IconComponent = selectedIcon?.icon || FolderOpen;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? t('categoryForm.newCategory') : t('categoryForm.editCategory')}
      description={mode === 'create' 
        ? t('categoryForm.createDescription')
        : t('categoryForm.editDescription')}
      titleIcon={<FolderOpen className="h-5 w-5 text-primary" />}
      className="sm:max-w-lg"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <ResponsiveDialogBody>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('categoryForm.nameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('categoryForm.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('categoryForm.descriptionLabel')}</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={t('categoryForm.descriptionPlaceholder')}
                      rows={2}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categoryForm.iconLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              <IconComponent className="h-4 w-4" />
                              <span>{selectedIcon?.label || t('common.select')}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px] bg-popover border border-border z-50">
                        {categoryIconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <option.icon className="h-4 w-4" />
                              <span>{option.label}</span>
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
                name="inspection_frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('categoryForm.frequencyLabel')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border border-border z-50">
                        {frequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      {t('categoryForm.frequencyDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-2" />

            <FormField
              control={form.control}
              name="blocking_expiries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('categoryForm.blockingExpiriesLabel', 'Vencimentos que reprovam o equipamento')}</FormLabel>
                  <FormDescription className="text-xs">
                    {t('categoryForm.blockingExpiriesDescription', 'Marque quais vencimentos, ao expirar, devem reprovar automaticamente o equipamento desta categoria.')}
                  </FormDescription>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {blockingExpiryOptions.map((opt) => {
                      const checked = field.value?.includes(opt.value) ?? false;
                      return (
                        <label
                          key={opt.value}
                          className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const current = field.value ?? [];
                              if (v) field.onChange([...current, opt.value]);
                              else field.onChange(current.filter((x) => x !== opt.value));
                            }}
                          />
                          <span className="text-sm">{opt.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-2" />

            {/* Checklist Items Editor */}
            <ChecklistItemsEditor
              items={checklistItems}
              onChange={setChecklistItems}
            />
          </ResponsiveDialogBody>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('common.saving')}
                </>
              ) : mode === 'create' ? (
                t('common.createCategory')
              ) : (
                t('common.saveChanges')
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
