import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Plus, Trash2, Eye, FileSpreadsheet } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useObsDatasets } from '@/hooks/useObsCards';
import { formatDateTime } from '@/utils/dateFormat';
import { ClassifyDatasetButton } from '@/components/obs-cards/ClassifyDatasetButton';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ready: 'default',
  processing: 'secondary',
  failed: 'destructive',
};

export default function ObsCardsDatasets() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: datasets, isLoading } = useObsDatasets();

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      while (true) {
        const { data, error } = await (supabase as any).rpc('delete_obs_card_dataset_batch', {
          _dataset_id: id,
          _batch_size: 500,
        });

        if (error) throw error;
        if (data && data.success === false) throw new Error(data.error || 'delete_failed');
        if (data?.dataset_deleted || !data?.has_more) break;

        await new Promise((resolve) => window.setTimeout(resolve, 50));
      }
    },
    onSuccess: () => {
      toast({ title: t('obsCards.datasets.deleted') });
      qc.invalidateQueries({ queryKey: ['obs-datasets'] });
    },
    onError: (e: any) =>
      toast({ title: t('obsCards.datasets.deleteError'), description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title={t('obsCards.datasets.title')}
        subtitle={t('obsCards.datasets.subtitle')}
        actions={
          <Button onClick={() => navigate('/obs-cards/upload')}>
            <Plus className="h-4 w-4 mr-2" />
            {t('obsCards.datasets.newUpload')}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Spinner size="lg" /></div>
          ) : !datasets || datasets.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{t('obsCards.datasets.empty')}</p>
              <Button className="mt-4" onClick={() => navigate('/obs-cards/upload')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('obsCards.datasets.newUpload')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('obsCards.datasets.name')}</TableHead>
                  <TableHead>{t('obsCards.datasets.filename')}</TableHead>
                  <TableHead className="text-right">{t('obsCards.datasets.rows')}</TableHead>
                  <TableHead>{t('obsCards.datasets.status')}</TableHead>
                  <TableHead>{t('obsCards.datasets.uploadedBy')}</TableHead>
                  <TableHead>{t('obsCards.datasets.uploadedAt')}</TableHead>
                  <TableHead className="text-right">{t('obsCards.datasets.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{d.original_filename}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.row_count}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[d.status] || 'outline'}>
                        {t(`obsCards.status.${d.status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{d.uploaded_by_name || '—'}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(d.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1 items-center">
                        <ClassifyDatasetButton datasetId={d.id} disabled={d.status !== 'ready'} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/obs-cards?dataset=${d.id}`)}
                          disabled={d.status !== 'ready'}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('obsCards.datasets.deleteConfirmTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('obsCards.datasets.deleteConfirmDescription')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(d.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                {t('common.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
