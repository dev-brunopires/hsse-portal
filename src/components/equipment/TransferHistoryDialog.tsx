import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRightLeft, Ship, Calendar, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useEquipmentTransfers } from '@/hooks/useEquipmentTransfers';

interface TransferHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentId: string;
  equipmentName: string;
}

export function TransferHistoryDialog({
  open,
  onOpenChange,
  equipmentId,
  equipmentName,
}: TransferHistoryDialogProps) {
  const { data: transfers = [], isLoading } = useEquipmentTransfers(equipmentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Histórico de Transferências</DialogTitle>
          <DialogDescription>{equipmentName}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowRightLeft className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma transferência registrada</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

              <div className="space-y-4">
                {transfers.map((transfer, index) => (
                  <div key={transfer.id} className="relative pl-10">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-primary border-2 border-background" />

                    <div className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(transfer.transfer_date), "dd 'de' MMMM 'de' yyyy", {
                            locale: ptBR,
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Ship className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {transfer.from_ship?.name || 'Sem navio'}
                          </span>
                        </div>
                        <ArrowRightLeft className="h-4 w-4 text-primary" />
                        <div className="flex items-center gap-2 text-sm">
                          <Ship className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{transfer.to_ship?.name}</span>
                        </div>
                      </div>

                      {transfer.reason && (
                        <div className="mb-2">
                          <Badge variant="outline" className="text-xs">
                            {transfer.reason}
                          </Badge>
                        </div>
                      )}

                      {transfer.notes && (
                        <p className="text-xs text-muted-foreground mb-2">{transfer.notes}</p>
                      )}

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>
                          Por {transfer.transferred_by_profile?.full_name || 'Desconhecido'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
