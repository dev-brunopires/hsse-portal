import { useState, useRef } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Upload, ShieldAlert, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { importObsCardsFromFile } from '@/utils/obsCardsImport';

const MAX_OBS_CARD_FILE_SIZE_MB = 20;

function getUploadErrorMessage(message: string | undefined, t: TFunction) {
  if (message?.includes('WORKER_RESOURCE_LIMIT')) return t('obsCards.upload.resourceLimitError');
  if (message?.includes('row_limit_exceeded')) return t('obsCards.upload.rowLimitError');
  if (message?.includes('file_too_large')) return t('obsCards.upload.fileTooLarge', { size: MAX_OBS_CARD_FILE_SIZE_MB });
  if (message?.includes('missing_headers')) return t('obsCards.upload.missingHeaders');
  if (message?.includes('empty_sheet')) return t('obsCards.upload.emptySheet');
  return message;
}

export default function ObsCardsUpload() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: t('obsCards.upload.requiredName'), variant: 'destructive' });
      return;
    }
    if (!file || !organization?.id) return;
    if (file.size > MAX_OBS_CARD_FILE_SIZE_MB * 1024 * 1024) {
      toast({
        title: t('obsCards.upload.error'),
        description: t('obsCards.upload.fileTooLarge', { size: MAX_OBS_CARD_FILE_SIZE_MB }),
        variant: 'destructive',
      });
      return;
    }
    setBusy(true);
    setProgress(0);
    let datasetId: string | null = null;
    try {
      // 1. Create dataset row
      const { data: ds, error: dsErr } = await supabase
        .from('obs_card_datasets' as any)
        .insert({
          organization_id: organization.id,
          name: name.trim(),
          original_filename: file.name,
          status: 'processing',
        })
        .select()
        .single();
      if (dsErr) throw dsErr;
      const dataset: any = ds;
      datasetId = dataset.id;
      setProgress(3);

      // 2. Upload to storage
      const path = `${organization.id}/${dataset.id}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from('obs-cards-uploads')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      setProgress(8);

      await supabase
        .from('obs_card_datasets' as any)
        .update({ source_storage_path: path })
        .eq('id', dataset.id);

      // 3. Process locally and insert in small chunks to avoid Edge Function compute limits
      const result = await importObsCardsFromFile({
        file,
        datasetId: dataset.id,
        organizationId: organization.id,
        onProgress: setProgress,
      });

      const { error: updateErr } = await supabase
        .from('obs_card_datasets' as any)
        .update({
          status: 'ready',
          row_count: result.inserted,
          column_mapping: result.mapping,
          uploaded_by: user?.id ?? null,
          uploaded_by_name: profile?.full_name || user?.user_metadata?.full_name || null,
        })
        .eq('id', dataset.id);
      if (updateErr) throw updateErr;
      setProgress(100);

      toast({
        title: t('obsCards.upload.success'),
        description: t('obsCards.upload.successDescription', { count: result.inserted }),
      });
      qc.invalidateQueries({ queryKey: ['obs-datasets'] });
      navigate(`/obs-cards?dataset=${dataset.id}`);
    } catch (e: any) {
      if (datasetId) {
        await supabase
          .from('obs_card_datasets' as any)
          .update({ status: 'failed', error_message: e.message })
          .eq('id', datasetId);
      }
      toast({
        title: t('obsCards.upload.error'),
        description: getUploadErrorMessage(e.message, t),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title={t('obsCards.upload.title')}
        subtitle={t('obsCards.upload.subtitle')}
        actions={
          <Button variant="outline" onClick={() => navigate('/obs-cards/datasets')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('obsCards.upload.back')}
          </Button>
        }
      />

      <Card className="max-w-2xl">
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label>{t('obsCards.upload.datasetName')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('obsCards.upload.datasetNamePlaceholder')}
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('obsCards.upload.file')}</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) setFile(f);
              }}
              onClick={() => !busy && fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
                busy && 'opacity-50 pointer-events-none',
              )}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm">{t('obsCards.upload.dropzone')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('obsCards.upload.supportedFormats')}
                  </p>
                </>
              )}
            </div>
          </div>

          {busy && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{t('obsCards.upload.processing')}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Button onClick={handleSubmit} disabled={busy || !file} className="w-full">
            {busy ? (
              <>
                <Spinner inline size="sm" iconClassName="mr-2 text-primary-foreground" />
                {t('obsCards.upload.processing')}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('obsCards.upload.submit')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
