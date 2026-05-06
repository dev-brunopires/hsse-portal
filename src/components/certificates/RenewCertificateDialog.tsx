import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Upload, X, FileText, Calendar } from 'lucide-react';
import { addMonths, format } from 'date-fns';

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';

import { useRenewCertificate, type Certificate } from '@/hooks/useCertificates';
import { formatDate } from '@/utils/dateFormat';

interface RenewCertificateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: Certificate | null;
}

const QUICK_OPTIONS = [
  { label: '+3 months', months: 3 },
  { label: '+6 months', months: 6 },
  { label: '+1 year', months: 12 },
  { label: '+2 years', months: 24 },
];

export function RenewCertificateDialog({
  open,
  onOpenChange,
  certificate,
}: RenewCertificateDialogProps) {
  const { t } = useTranslation();
  const renewCertificate = useRenewCertificate();

  const [newIssueDate, setNewIssueDate] = useState<string>('');
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);

  if (!certificate) return null;

  const handleQuickOption = (months: number) => {
    const baseDate = newIssueDate
      ? new Date(newIssueDate)
      : certificate.expiry_date
      ? new Date(certificate.expiry_date)
      : new Date();
    const newDate = addMonths(baseDate, months);
    setNewExpiryDate(format(newDate, 'yyyy-MM-dd'));
  };

  const handleSubmit = async () => {
    if (!newIssueDate || !newExpiryDate) return;

    await renewCertificate.mutateAsync({
      certificateId: certificate.id,
      newIssueDate,
      newExpiryDate,
      notes: notes || undefined,
      file: file || undefined,
    });

    onOpenChange(false);
    setNewIssueDate('');
    setNewExpiryDate('');
    setNotes('');
    setFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={t('certificates.renewTitle')}
      titleIcon={<RefreshCw className="h-5 w-5 text-primary" />}
      className="max-w-md"
    >
      <ResponsiveDialogBody className="space-y-4">
        {/* Current Info */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-medium">{certificate.name}</h4>
          <p className="text-sm text-muted-foreground">
            {certificate.equipment?.name} ({certificate.equipment?.internal_code})
          </p>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('certificates.currentExpiry')}:</span>
            <Badge variant={certificate.status === 'expired' ? 'destructive' : 'outline'}>
              {certificate.expiry_date ? formatDate(certificate.expiry_date) : '-'}
            </Badge>
          </div>
        </div>

        {/* Quick Options */}
        <div>
          <Label>{t('certificates.quickOptions')}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {QUICK_OPTIONS.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickOption(option.months)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* New Issue Date (required) */}
        <div>
          <Label>{t('certificates.newIssueDate')} *</Label>
          <div className="mt-2">
            <DatePicker
              value={newIssueDate}
              onChange={setNewIssueDate}
            />
          </div>
        </div>

        {/* New Expiry Date */}
        <div>
          <Label>{t('certificates.newExpiryDate')} *</Label>
          <div className="mt-2">
            <DatePicker
              value={newExpiryDate}
              onChange={setNewExpiryDate}
            />
          </div>
          {newExpiryDate && (
            <p className="text-sm text-green-600 mt-1">
              {t('certificates.newExpirySelected')}: {formatDate(newExpiryDate)}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <Label>{t('certificates.renewalNotes')}</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('certificates.renewalNotesPlaceholder')}
            rows={3}
            className="mt-2"
          />
        </div>

        {/* New File Upload */}
        <div>
          <Label>{t('certificates.newCertificateFile')}</Label>
          {file ? (
            <div className="mt-2 flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-blue-500" />
              <span className="flex-1 truncate text-sm">{file.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="mt-2">
              <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <span className="text-sm text-muted-foreground">
                  {t('certificates.uploadNewFile')}
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          )}
        </div>
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!newExpiryDate || renewCertificate.isPending}
        >
          {renewCertificate.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          {t('certificates.confirmRenewal')}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
