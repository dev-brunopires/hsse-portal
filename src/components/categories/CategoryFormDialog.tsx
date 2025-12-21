import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Loader2, FolderOpen } from 'lucide-react';
import { useCreateCategory, useUpdateCategory, type Category } from '@/hooks/useCategories';
import { categoryIconOptions, getCategoryIcon } from '@/utils/categoryIcons';

const categorySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  icon: z.string().min(1, 'Selecione um ícone'),
  inspection_frequency: z.string().min(1, 'Selecione a frequência'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

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

  const frequencyOptions = [
    { value: 'monthly', label: t('categoryForm.monthly') },
    { value: 'quarterly', label: t('categoryForm.quarterly') },
    { value: 'semiannual', label: t('categoryForm.semiannual') },
    { value: 'annual', label: t('categoryForm.annual') },
    { value: 'custom', label: t('categoryForm.custom') },
  ];

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      description: '',
      icon: 'package',
      inspection_frequency: 'monthly',
    },
  });

  useEffect(() => {
    if (open && category && mode === 'edit') {
      form.reset({
        name: category.name,
        description: category.description || '',
        icon: category.icon || 'package',
        inspection_frequency: category.inspection_frequency,
      });
    } else if (open && mode === 'create') {
      form.reset({
        name: '',
        description: '',
        icon: 'package',
        inspection_frequency: 'monthly',
      });
    }
  }, [open, category, mode, form]);

  const onSubmit = async (data: CategoryFormData) => {
    if (mode === 'create') {
      await createCategory.mutateAsync({
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
      });
    } else if (category) {
      await updateCategory.mutateAsync({
        id: category.id,
        name: data.name,
        description: data.description || null,
        icon: data.icon,
        inspection_frequency: data.inspection_frequency,
      });
    }
    onOpenChange(false);
  };

  const isSubmitting = createCategory.isPending || updateCategory.isPending;
  const selectedIcon = categoryIconOptions.find(i => i.value === form.watch('icon'));
  const IconComponent = selectedIcon?.icon || FolderOpen;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {mode === 'create' ? t('categoryForm.newCategory') : t('categoryForm.editCategory')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? t('categoryForm.createDescription')
              : t('categoryForm.editDescription')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
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
                      <SelectContent className="max-h-[300px]">
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
                      <SelectContent>
                        {frequencyOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('categoryForm.frequencyDescription')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
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
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
