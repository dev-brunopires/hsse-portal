import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { listSubmissionsLocal } from '../offline';
import type { EvvSubmission } from '../types';
import { formatDateTime } from '@/utils/dateFormat';

const STATUS_VARIANT: Record<EvvSubmission['status'], 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  draft: 'secondary',
  not_synced: 'destructive',
};

export default function EvvHistory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<EvvSubmission[]>([]);

  useEffect(() => { listSubmissionsLocal().then(setRows); }, []);

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
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.client_id}>
                    <TableCell className="font-medium">{t(`evv.forms.${r.form_type}.title`)}</TableCell>
                    <TableCell>{formatDateTime(r.updated_at)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{t(`evv.status.${r.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="link"
                        onClick={() => navigate(`/evv/forms/${r.form_type}?draft=${r.client_id}`)}
                      >
                        {r.status === 'draft' ? t('evv.history.resume') : t('evv.history.view')}
                      </Button>
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
