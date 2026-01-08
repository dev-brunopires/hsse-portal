import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ChecklistItemData {
  id?: string;
  description: string;
  is_required?: boolean;
}

interface ChecklistItemsEditorProps {
  items: ChecklistItemData[];
  onChange: (items: ChecklistItemData[]) => void;
  disabled?: boolean;
}

export function ChecklistItemsEditor({ items, onChange, disabled }: ChecklistItemsEditorProps) {
  const { t } = useTranslation();
  const [newItemText, setNewItemText] = useState('');

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    
    onChange([
      ...items,
      {
        description: newItemText.trim(),
        is_required: true,
      },
    ]);
    setNewItemText('');
  };

  const handleRemoveItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, description: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], description };
    onChange(newItems);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('checklistEditor.inspectionItems')}</span>
        <span className="text-xs text-muted-foreground">({items.length})</span>
      </div>
      
      {/* Existing items */}
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "flex items-center gap-2 p-2 rounded-lg border bg-muted/30 group",
              disabled && "opacity-50"
            )}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
            <Input
              value={item.description}
              onChange={(e) => handleUpdateItem(index, e.target.value)}
              className="flex-1 h-8 text-sm"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={() => handleRemoveItem(index)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add new item */}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            placeholder={t('checklistEditor.addItemPlaceholder')}
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAddItem}
            disabled={!newItemText.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 border border-dashed rounded-lg">
          {t('checklistEditor.noItemsYet')}
        </p>
      )}
    </div>
  );
}
