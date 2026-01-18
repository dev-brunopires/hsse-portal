import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface EquipmentChange {
  id: string;
  internalCode: string;
  name: string;
  changes: FieldChange[];
}

interface ImportChangesPreviewProps {
  equipmentChanges: EquipmentChange[];
  className?: string;
}

export function ImportChangesPreview({ equipmentChanges, className }: ImportChangesPreviewProps) {
  const { t } = useTranslation();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedItems(new Set(equipmentChanges.map(e => e.id)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  if (equipmentChanges.length === 0) {
    return null;
  }

  const totalChanges = equipmentChanges.reduce((sum, eq) => sum + eq.changes.length, 0);

  return (
    <div className={cn("border rounded-lg", className)}>
      <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm flex items-center gap-2">
            {t('importEquipment.previewChanges')}
            <Badge variant="outline" className="bg-status-warning/10 text-status-warning border-status-warning/30">
              {totalChanges} {t('importEquipment.fieldChanges')}
            </Badge>
          </h4>
          <p className="text-xs text-muted-foreground mt-1">
            {t('importEquipment.previewChangesDesc', { count: equipmentChanges.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={expandAll}
            className="text-xs text-primary hover:underline"
          >
            {t('importEquipment.expandAll')}
          </button>
          <span className="text-muted-foreground">|</span>
          <button 
            onClick={collapseAll}
            className="text-xs text-primary hover:underline"
          >
            {t('importEquipment.collapseAll')}
          </button>
        </div>
      </div>
      
      <ScrollArea className="max-h-64">
        <div className="divide-y">
          {equipmentChanges.map((equipment) => (
            <Collapsible
              key={equipment.id}
              open={expandedItems.has(equipment.id)}
              onOpenChange={() => toggleItem(equipment.id)}
            >
              <CollapsibleTrigger className="w-full p-3 flex items-center gap-2 hover:bg-muted/50 transition-colors text-left">
                {expandedItems.has(equipment.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {equipment.internalCode}
                    </span>
                    <span className="font-medium text-sm truncate">
                      {equipment.name}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  {equipment.changes.length} {equipment.changes.length === 1 
                    ? t('importEquipment.change') 
                    : t('importEquipment.changes')}
                </Badge>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-3 pb-3 pl-9 space-y-2">
                  {equipment.changes.map((change, idx) => (
                    <div 
                      key={idx}
                      className="flex items-start gap-2 text-sm bg-muted/30 rounded-md p-2"
                    >
                      <span className="font-medium text-xs min-w-24 text-muted-foreground">
                        {change.fieldLabel}:
                      </span>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs truncate max-w-32",
                          change.oldValue 
                            ? "bg-destructive/10 text-destructive line-through" 
                            : "bg-muted text-muted-foreground italic"
                        )}>
                          {change.oldValue || t('importEquipment.empty')}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs truncate max-w-32",
                          change.newValue 
                            ? "bg-status-success/10 text-status-success font-medium" 
                            : "bg-muted text-muted-foreground italic"
                        )}>
                          {change.newValue || t('importEquipment.empty')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
