import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, Plus, Trash2, Loader2, Star, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { ChecklistItemsEditor, type ChecklistItemData } from './ChecklistItemsEditor';
import { 
  useChecklistTemplates, 
  useCreateChecklistTemplate, 
  useUpdateChecklistTemplate,
  useDeleteChecklistTemplate,
  type ChecklistTemplate 
} from '@/hooks/useChecklistTemplates';
import type { Category } from '@/hooks/useCategories';

interface ChecklistTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category;
}

export function ChecklistTemplatesDialog({ open, onOpenChange, category }: ChecklistTemplatesDialogProps) {
  const { t } = useTranslation();
  const { data: templates, isLoading } = useChecklistTemplates(category.id);
  const createTemplate = useCreateChecklistTemplate();
  const updateTemplate = useUpdateChecklistTemplate();
  const deleteTemplate = useDeleteChecklistTemplate();

  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateItems, setTemplateItems] = useState<ChecklistItemData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<ChecklistTemplate | null>(null);

  useEffect(() => {
    if (!open) {
      setEditingTemplate(null);
      setTemplateName('');
      setTemplateItems([]);
      setIsCreating(false);
    }
  }, [open]);

  const handleStartCreate = () => {
    setIsCreating(true);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateItems([]);
  };

  const handleStartEdit = (template: ChecklistTemplate) => {
    setIsCreating(false);
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateItems(template.items?.map(i => ({
      id: i.id,
      description: i.description,
      is_required: i.is_required,
    })) || []);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateItems([]);
  };

  const handleDuplicate = (template: ChecklistTemplate) => {
    setIsCreating(true);
    setEditingTemplate(null);
    setTemplateName(`${template.name} (${t('checklistTemplates.copy')})`);
    setTemplateItems(template.items?.map(i => ({
      description: i.description,
      is_required: i.is_required,
      tempId: `dup-${Date.now()}-${Math.random()}`,
    })) || []);
  };

  const handleSave = async () => {
    if (!templateName.trim()) return;

    if (isCreating) {
      await createTemplate.mutateAsync({
        template: {
          category_id: category.id,
          name: templateName,
          is_default: templates?.length === 0,
        },
        items: templateItems,
      });
    } else if (editingTemplate) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        template: { name: templateName },
        items: templateItems,
      });
    }
    
    handleCancel();
  };

  const handleSetDefault = async (template: ChecklistTemplate) => {
    await updateTemplate.mutateAsync({
      id: template.id,
      template: { 
        is_default: true,
        category_id: template.category_id,
      },
    });
  };

  const handleDeleteClick = (template: ChecklistTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (templateToDelete) {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;
  const isEditorOpen = isCreating || editingTemplate !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              {t('checklistTemplates.title')}
            </DialogTitle>
            <DialogDescription>
              {t('checklistTemplates.description', { category: category.name })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-4 h-[500px]">
            {/* Templates List */}
            <div className="w-1/3 border-r pr-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-medium">{t('checklistTemplates.templates')}</Label>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleStartCreate}
                  disabled={isEditorOpen}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              <ScrollArea className="h-[calc(100%-40px)]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : templates?.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {t('checklistTemplates.noTemplates')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {templates?.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          editingTemplate?.id === template.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleStartEdit(template)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate flex-1">
                            {template.name}
                          </span>
                          <div className="flex items-center gap-1 ml-2">
                            {template.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                {t('common.default')}
                              </Badge>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicate(template);
                                  }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('checklistTemplates.duplicate')}</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {template.items?.length || 0} {t('checklistTemplates.items')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Editor */}
            <div className="flex-1">
              {isEditorOpen ? (
                <div className="h-full flex flex-col">
                  <div className="space-y-4 flex-1 overflow-y-auto">
                    <div>
                      <Label>{t('checklistTemplates.templateName')}</Label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder={t('checklistTemplates.templateNamePlaceholder')}
                        className="mt-1"
                      />
                    </div>

                    <Separator />

                    <ChecklistItemsEditor
                      items={templateItems}
                      onChange={setTemplateItems}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <div className="flex gap-2">
                      {editingTemplate && !editingTemplate.is_default && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(editingTemplate)}
                          disabled={updateTemplate.isPending}
                        >
                          <Star className="h-4 w-4 mr-1" />
                          {t('checklistTemplates.setAsDefault')}
                        </Button>
                      )}
                      {editingTemplate && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(editingTemplate)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={handleCancel}>
                        {t('common.cancel')}
                      </Button>
                      <Button 
                        onClick={handleSave}
                        disabled={!templateName.trim() || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            {t('common.saving')}
                          </>
                        ) : (
                          t('common.save')
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('checklistTemplates.selectOrCreate')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('checklistTemplates.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('checklistTemplates.confirmDeleteDescription', { name: templateToDelete?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('common.deleting')}
                </>
              ) : (
                t('common.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
