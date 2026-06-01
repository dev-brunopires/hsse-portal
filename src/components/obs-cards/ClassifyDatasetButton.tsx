import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface Props {
  datasetId: string;
  disabled?: boolean;
}

export function ClassifyDatasetButton({ datasetId, disabled }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; remaining: number } | null>(null);

  const run = async (reclassify: boolean) => {
    setBusy(true);
    setProgress(null);
    let totalProcessed = 0;
    try {
      for (let i = 0; i < 2000; i++) {
        const { data, error } = await supabase.functions.invoke('classify-obs-cards', {
          body: {
            dataset_id: datasetId,
            batch_size: 25,
            reclassify: reclassify && i === 0,
          },
        });
        if (error) throw error;
        const res = data as { processed: number; remaining: number; done: boolean; error?: string };
        if (res?.error) throw new Error(res.error);
        totalProcessed += res.processed || 0;
        setProgress({ processed: totalProcessed, remaining: res.remaining || 0 });
        if (res.done || (res.processed === 0 && res.remaining === 0)) break;
      }
      toast({
        title: t('obsCards.classify.success'),
        description: t('obsCards.classify.successDesc', { count: totalProcessed }),
      });
      window.dispatchEvent(new CustomEvent('obs-cards:refresh', { detail: { datasetId } }));
    } catch (e: any) {
      const msg = String(e?.message || '');
      let desc = msg;
      if (msg.includes('rate_limited') || msg.includes('429')) desc = t('obsCards.classify.rateLimited');
      else if (msg.includes('payment_required') || msg.includes('402')) desc = t('obsCards.classify.paymentRequired');
      toast({ title: t('obsCards.classify.error'), description: desc, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Spinner inline size="xs" iconClassName="mr-2" />
        {progress
          ? t('obsCards.classify.progress', { processed: progress.processed, remaining: progress.remaining })
          : t('obsCards.classify.starting')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} title={t('obsCards.classify.tooltip')}>
          <Sparkles className="h-4 w-4 mr-2" />
          {t('obsCards.classify.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run(false)}>
          <Sparkles className="h-4 w-4 mr-2" />
          {t('obsCards.classify.runIncremental')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run(true)}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('obsCards.classify.runReclassify')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
