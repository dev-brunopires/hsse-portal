import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { listSubmissionsLocal } from '../offline';
import type { EvvSubmission } from '../types';
import type { EvvFormType } from '../catalog';
import { formatDateTime } from '@/utils/dateFormat';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';

const STATUS_VARIANT: Record<EvvSubmission['status'], 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  draft: 'secondary',
  not_synced: 'destructive',
};

const REVIEW_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  approved: 'default',
  rejected: 'destructive',
  pending: 'secondary',
};

interface ServerRow {
  id: string;
  client_id: string;
  form_type: EvvFormType;
  status: string;
  review_status: string | null;
  submitted_at: string | null;
  updated_at: string;
}

interface MergedRow {
  key: string;
  client_id: string;
  server_id?: string;
  form_type: EvvFormType;
  status: EvvSubmission['status'];
  review_status?: string | null;
  date: string;
}

export default function EvvHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useOrganization();
  const [localRows, setLocalRows] = useState<EvvSubmission[]>([]);

  useEffect(() => { listSubmissionsLocal().then(setLocalRows); }, []);

  const { data: serverRows = [] } = useQuery({
    queryKey: ['evv-submissions-server', organization?.id],
    enabled: !!organization?.id && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evv_submissions' as any)
        .select('id, client_id, form_type, status, review_status, submitted_at, updated_at')
        .eq('organization_id', organization!.id)
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as ServerRow[];
    },
  });

  const rows = useMemo<MergedRow[]>(() => {
    const byClient = new Map<string, MergedRow>();
    serverRows.forEach((s) => {
      byClient.set(s.client_id, {
        key: s.id,
        client_id: s.client_id,
        server_id: s.id,
        form_type: s.form_type,
        status: 'completed',
        review_status: s.review_status,
        date: s.submitted_at ?? s.updated_at,
      });
    });
    localRows.forEach((l) => {
      if (byClient.has(l.client_id)) return;
      byClient.set(l.client_id, {
        key: l.client_id,
        client_id: l.client_id,
        form_type: l.form_type,
        status: l.status,
        date: l.updated_at,
      });
    });
    return Array.from(byClient.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [serverRows, localRows]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Plus}
        title={t('evv.history.title')}
        description={t('evv.history.subtitle')}
        actions={(
          <Button asChild><Link to="/evv/forms"><Plus />{t('evv.history.new')}</Link></Button>
        )}
      />
      <Card>
        <CardHeader><CardTitle>{t('evv.history.allSubmissions')}</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('evv.history.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('evv.history.formType')}</TableHead>
                  <TableHead>{t('evv.history.date')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('evv.detail.reviewTitle')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">{t(`evv.forms.${r.form_type === 'leaders_engagement' ? 'leaders' : r.form_type === 'workers_engagement' ? 'workers' : r.form_type}.title`)}</TableCell>
                    <TableCell>{formatDateTime(r.date)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{t(`evv.status.${r.status}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.server_id ? (
                        <Badge variant={REVIEW_VARIANT[r.review_status ?? 'pending']}>
                          {t(`evv.review.${r.review_status ?? 'pending'}`)}
                        </Badge>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.server_id ? (
                        <Button variant="link" onClick={() => navigate(`/evv/history/${r.server_id}`)}>
                          {t('evv.history.openDetail')}
                        </Button>
                      ) : (
                        <Button
                          variant="link"
                          onClick={() => navigate(`/evv/forms/${r.form_type}?draft=${r.client_id}`)}
                        >
                          {r.status === 'draft' ? t('evv.history.resume') : t('evv.history.view')}
                        </Button>
                      )}
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
