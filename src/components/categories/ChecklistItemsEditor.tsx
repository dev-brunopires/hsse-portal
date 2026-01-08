import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface ChecklistItemData {
  id?: string;
  description: string;
  is_required?: boolean;
  tempId?: string; // For drag and drop identification
}

interface ChecklistItemsEditorProps {
  items: ChecklistItemData[];
  onChange: (items: ChecklistItemData[]) => void;
  disabled?: boolean;
}

interface SortableItemProps {
  item: ChecklistItemData;
  index: number;
  onUpdate: (index: number, description: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

function SortableItem({ item, index, onUpdate, onRemove, disabled }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.tempId || item.id || `item-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg border bg-muted/30 group",
        isDragging && "opacity-50 shadow-lg z-50",
        disabled && "opacity-50"
      )}
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      </button>
      <span className="text-xs text-muted-foreground w-5">{index + 1}.</span>
      <Input
        value={item.description}
        onChange={(e) => onUpdate(index, e.target.value)}
        className="flex-1 h-8 text-sm"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
        onClick={() => onRemove(index)}
        disabled={disabled}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function ChecklistItemsEditor({ items, onChange, disabled }: ChecklistItemsEditorProps) {
  const { t } = useTranslation();
  const [newItemText, setNewItemText] = useState('');

  // Ensure all items have a unique ID for drag and drop
  const itemsWithIds = items.map((item, index) => ({
    ...item,
    tempId: item.tempId || item.id || `temp-${index}-${Date.now()}`,
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = itemsWithIds.findIndex((item) => item.tempId === active.id);
      const newIndex = itemsWithIds.findIndex((item) => item.tempId === over.id);
      
      const newItems = arrayMove(itemsWithIds, oldIndex, newIndex);
      onChange(newItems);
    }
  };

  const handleAddItem = () => {
    if (!newItemText.trim()) return;
    
    onChange([
      ...items,
      {
        description: newItemText.trim(),
        is_required: true,
        tempId: `new-${Date.now()}`,
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
      
      {/* Existing items with drag and drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={itemsWithIds.map(item => item.tempId!)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {itemsWithIds.map((item, index) => (
              <SortableItem
                key={item.tempId}
                item={item}
                index={index}
                onUpdate={handleUpdateItem}
                onRemove={handleRemoveItem}
                disabled={disabled}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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
