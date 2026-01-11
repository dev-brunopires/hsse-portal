import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Upload, X, FileText, Award } from 'lucide-react';
import { format } from 'date-fns';

import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { DatePicker } from '@/components/ui/date-picker';

import { useEquipment } from '@/hooks/useEquipment';
import {
  useCreateCertificate,
  useUpdateCertificate,
  type Certificate,
  type CertificateFormData,
} from '@/hooks/useCertificates';

const formSchema = z.object({
  equipment_id: z.string().min(1, 'Equipment is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  certificate_number: z.string().optional(),
  issuer: z.string().optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface CertificateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: Certificate | null;
}

const CERTIFICATE_TYPES = [
  { value: 'certificate', label: 'certificates.types.certificate' },
  { value: 'document', label: 'certificates.types.document' },
  { value: 'license', label: 'certificates.types.license' },
  { value: 'permit', label: 'certificates.types.permit' },
  { value: 'test_report', label: 'certificates.types.testReport' },
];

export function CertificateFormDialog({
  open,
  onOpenChange,
  certificate,
}: CertificateFormDialogProps) {
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);

  const { data: equipment = [] } = useEquipment();
  const createCertificate = useCreateCertificate();
  const updateCertificate = useUpdateCertificate();

  const isEditing = !!certificate;
  const isLoading = createCertificate.isPending || updateCertificate.isPending;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipment_id: '',
      name: '',
      type: 'certificate',
      certificate_number: '',
      issuer: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open && certificate) {
      form.reset({
        equipment_id: certificate.equipment_id,
        name: certificate.name,
        type: certificate.type,
        certificate_number: certificate.certificate_number || '',
        issuer: certificate.issuer || '',
        issue_date: certificate.issue_date || '',
        expiry_date: certificate.expiry_date || '',
        notes: certificate.notes || '',
      });
    } else if (open) {
      form.reset({
        equipment_id: '',
        name: '',
        type: 'certificate',
        certificate_number: '',
        issuer: '',
        notes: '',
      });
      setFile(null);
    }
  }, [open, certificate, form]);

  const onSubmit = async (data: FormData) => {
    const selectedEquipment = equipment.find((e) => e.id === data.equipment_id);

    const formData: CertificateFormData = {
      equipment_id: data.equipment_id,
      ship_id: selectedEquipment?.ship_id,
      name: data.name,
      type: data.type,
      certificate_number: data.certificate_number,
      issuer: data.issuer,
      issue_date: data.issue_date,
      expiry_date: data.expiry_date,
      notes: data.notes,
    };

    if (isEditing && certificate) {
      await updateCertificate.mutateAsync({
        id: certificate.id,
        data: formData,
        file: file || undefined,
      });
    } else {
      await createCertificate.mutateAsync({
        data: formData,
        file: file || undefined,
      });
    }

    onOpenChange(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      title={isEditing ? t('certificates.edit') : t('certificates.add')}
      titleIcon={<Award className="h-5 w-5 text-primary" />}
      className="max-w-lg"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <ResponsiveDialogBody>
            <FormField
              control={form.control}
              name="equipment_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('certificates.equipment')} *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('certificates.selectEquipment')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipment.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} ({eq.internal_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.name')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.type')} *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CERTIFICATE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {t(type.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="certificate_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.number')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="issuer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.issuer')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issue_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.issueDate')}</FormLabel>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('certificates.expiryDate')}</FormLabel>
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('certificates.notes')}</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <div>
              <Label>{t('certificates.file')}</Label>
              {file ? (
                <div className="mt-2 flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="flex-1 truncate text-sm">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : certificate?.file_name ? (
                <div className="mt-2 flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="flex-1 truncate text-sm">{certificate.file_name}</span>
                  <span className="text-xs text-muted-foreground">{t('certificates.currentFile')}</span>
                </div>
              ) : (
                <div className="mt-2">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      {t('certificates.uploadFile')}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('common.saving') : t('common.save')}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
