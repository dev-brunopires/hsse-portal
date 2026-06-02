import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, RefreshCw, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Props {
  datasetId: string;
  disabled?: boolean;
  /** IDs already filtered on screen still needing classification (ai_category == null). */
  filteredPendingIds?: string[];
  /** All IDs in current filter (for reclassify-filtered). */
  filteredAllIds?: string[];
}

const BATCH = 80;

export function ClassifyDatasetButton({ datasetId, disabled, filteredPendingIds, filteredAllIds }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; remaining: number } | null>(null);

  const runChunked = async (ids: string[], reclassify: boolean) => {
    let totalProcessed = 0;
    const total = ids.length;
    setProgress({ processed: 0, remaining: total });
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const { data, error } = await supabase.functions.invoke('classify-obs-cards', {
        body: {
          dataset_id: datasetId,
          card_ids: chunk,
          batch_size: BATCH,
          reclassify: reclassify && i === 0,
        },
      });
      if (error) throw error;
      const res = data as { processed: number; error?: string };
      if (res?.error) throw new Error(res.error);
      totalProcessed += res.processed || 0;
      setProgress({ processed: totalProcessed, remaining: Math.max(0, total - totalProcessed) });
    }
    return totalProcessed;
  };

  const runAll = async (reclassify: boolean) => {
    let totalProcessed = 0;
    for (let i = 0; i < 2000; i++) {
      const { data, error } = await supabase.functions.invoke('classify-obs-cards', {
        body: { dataset_id: datasetId, batch_size: BATCH, reclassify: reclassify && i === 0 },
      });
      if (error) throw error;
      const res = data as { processed: number; remaining: number; done: boolean; error?: string };
      if (res?.error) throw new Error(res.error);
      totalProcessed += res.processed || 0;
      setProgress({ processed: totalProcessed, remaining: res.remaining || 0 });
      if (res.done || (res.processed === 0 && res.remaining === 0)) break;
    }
    return totalProcessed;
  };

  const run = async (mode: 'all' | 'all-reclassify' | 'filtered' | 'filtered-reclassify') => {
    setBusy(true);
    setProgress(null);
    try {
      let totalProcessed = 0;
      if (mode === 'all') totalProcessed = await runAll(false);
      else if (mode === 'all-reclassify') totalProcessed = await runAll(true);
      else if (mode === 'filtered') totalProcessed = await runChunked(filteredPendingIds || [], false);
      else if (mode === 'filtered-reclassify') totalProcessed = await runChunked(filteredAllIds || [], true);

      toast({
        title: t('obsCards.classify.success'),
        description: t('obsCards.classify.successDesc', { count: totalProcessed }),
      });
      window.dispatchEvent(new CustomEvent('obs-cards:refresh', { detail: { datasetId, rebuildSummary: true } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e || '');
      let desc = msg;
      if (msg.includes('rate_limited') || msg.includes('429')) desc = t('obsCards.classify.rateLimited');
      else if (msg.includes('payment_required') || msg.includes('402')) desc = t('obsCards.classify.paymentRequired');
      else if (msg.includes('Failed to send a request') || msg.includes('Failed to fetch')) {
        desc = t('obsCards.classify.functionUnavailable');
      }
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

  const pendingFilteredCount = filteredPendingIds?.length ?? 0;
  const allFilteredCount = filteredAllIds?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled} title={t('obsCards.classify.tooltip')}>
          <Sparkles className="h-4 w-4 mr-2" />
          {t('obsCards.classify.button')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {pendingFilteredCount > 0 && (
          <DropdownMenuItem onClick={() => run('filtered')}>
            <Filter className="h-4 w-4 mr-2" />
            {t('obsCards.classify.runFilteredPending', { count: pendingFilteredCount })}
          </DropdownMenuItem>
        )}
        {allFilteredCount > 0 && (
          <DropdownMenuItem onClick={() => run('filtered-reclassify')}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('obsCards.classify.runFilteredReclassify', { count: allFilteredCount })}
          </DropdownMenuItem>
        )}
        {(pendingFilteredCount > 0 || allFilteredCount > 0) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={() => run('all')}>
          <Sparkles className="h-4 w-4 mr-2" />
          {t('obsCards.classify.runIncremental')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run('all-reclassify')}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {t('obsCards.classify.runReclassify')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
