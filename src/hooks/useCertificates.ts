import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useShipFilter } from '@/contexts/ShipFilterContext';
import { useOrganization } from '@/contexts/OrganizationContext';

export interface Certificate {
  id: string;
  equipment_id: string;
  ship_id: string | null;
  organization_id: string | null;
  name: string;
  type: string;
  certificate_number: string | null;
  issuer: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  renewal_date: string | null;
  last_renewal_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  status: string;
  renewal_status: string | null;
  notes: string | null;
  renewal_notes: string | null;
  created_by: string | null;
  renewed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  equipment?: {
    id: string;
    name: string;
    internal_code: string;
  } | null;
  ships?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
}

export interface CertificateRenewal {
  id: string;
  certificate_id: string;
  previous_expiry_date: string | null;
  new_expiry_date: string;
  renewed_by: string | null;
  renewed_at: string;
  old_file_path: string | null;
  new_file_path: string | null;
  notes: string | null;
  created_at: string;
}

export interface CertificateFormData {
  equipment_id: string;
  ship_id?: string | null;
  name: string;
  type: string;
  certificate_number?: string;
  issuer?: string;
  issue_date?: string;
  expiry_date?: string;
  notes?: string;
}

export function useCertificates(filters?: {
  equipmentId?: string;
  status?: string;
  type?: string;
  expiringDays?: number;
}) {
  const { selectedShipId, isReady } = useShipFilter();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['certificates', selectedShipId, filters, organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('certificates')
        .select(`
          *,
          equipment:equipment_id (id, name, internal_code),
          ships:ship_id (id, name, code)
        `)
        .order('expiry_date', { ascending: true, nullsFirst: false });

      // Filter by organization
      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }

      // Filter by ship - always apply when a ship is selected
      if (selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      // Filter by equipment
      if (filters?.equipmentId) {
        query = query.eq('equipment_id', filters.equipmentId);
      }

      // Filter by status
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Filter by type
      if (filters?.type && filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }

      // Filter by expiring within X days
      if (filters?.expiringDays) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + filters.expiringDays);
        query = query
          .gte('expiry_date', new Date().toISOString().split('T')[0])
          .lte('expiry_date', futureDate.toISOString().split('T')[0]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Certificate[];
    },
    enabled: isReady && !!organization?.id,
  });
}

export function useCertificateStats() {
  const { selectedShipId, isReady } = useShipFilter();
  const { organization } = useOrganization();

  return useQuery({
    queryKey: ['certificate-stats', selectedShipId, organization?.id],
    queryFn: async () => {
      let query = supabase
        .from('certificates')
        .select('status, type, expiry_date');

      if (organization?.id) {
        query = query.eq('organization_id', organization.id);
      }

      // Always apply ship filter when a ship is selected
      if (selectedShipId) {
        query = query.eq('ship_id', selectedShipId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const today = new Date();
      const in30Days = new Date();
      in30Days.setDate(today.getDate() + 30);
      const in60Days = new Date();
      in60Days.setDate(today.getDate() + 60);
      const in90Days = new Date();
      in90Days.setDate(today.getDate() + 90);

      const stats = {
        total: data?.length || 0,
        valid: data?.filter(c => c.status === 'valid').length || 0,
        expiringSoon: data?.filter(c => c.status === 'expiring_soon').length || 0,
        expired: data?.filter(c => c.status === 'expired').length || 0,
        expiring30: data?.filter(c => {
          if (!c.expiry_date) return false;
          const expiry = new Date(c.expiry_date);
          return expiry >= today && expiry <= in30Days;
        }).length || 0,
        expiring60: data?.filter(c => {
          if (!c.expiry_date) return false;
          const expiry = new Date(c.expiry_date);
          return expiry >= today && expiry <= in60Days;
        }).length || 0,
        expiring90: data?.filter(c => {
          if (!c.expiry_date) return false;
          const expiry = new Date(c.expiry_date);
          return expiry >= today && expiry <= in90Days;
        }).length || 0,
        byType: {
          certificate: data?.filter(c => c.type === 'certificate').length || 0,
          document: data?.filter(c => c.type === 'document').length || 0,
          license: data?.filter(c => c.type === 'license').length || 0,
          permit: data?.filter(c => c.type === 'permit').length || 0,
          test_report: data?.filter(c => c.type === 'test_report').length || 0,
        },
      };

      return stats;
    },
    enabled: isReady && !!organization?.id,
  });
}

export function useCreateCertificate() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async ({
      data,
      file,
    }: {
      data: CertificateFormData;
      file?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let filePath: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // Upload file if provided
      if (file && organization?.id) {
        const timestamp = Date.now();
        filePath = `${organization.id}/${data.equipment_id}/${timestamp}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        fileName = file.name;
        fileType = file.type;
        fileSize = file.size;
      }

      const { data: certificate, error } = await supabase
        .from('certificates')
        .insert({
          ...data,
          organization_id: organization?.id,
          file_path: filePath,
          file_name: fileName,
          file_type: fileType,
          file_size: fileSize,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Sync certificate_expiry to equipment if expiry_date provided
      if (data.expiry_date && certificate.equipment_id) {
        await supabase
          .from('equipment')
          .update({ certificate_expiry: data.expiry_date })
          .eq('id', certificate.equipment_id);
      }

      return certificate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('certificates.createSuccess'));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.createError'), {
        description: error.message,
      });
    },
  });
}

export function useUpdateCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      file,
    }: {
      id: string;
      data: Partial<CertificateFormData>;
      file?: File;
    }) => {
      let updateData: Record<string, unknown> = { ...data };

      // Upload new file if provided
      if (file) {
        // Get existing certificate to get organization_id
        const { data: existing } = await supabase
          .from('certificates')
          .select('organization_id, equipment_id, file_path')
          .eq('id', id)
          .single();

        if (existing?.organization_id) {
          const timestamp = Date.now();
          const filePath = `${existing.organization_id}/${existing.equipment_id}/${timestamp}_${file.name}`;
          
          // Delete old file if exists
          if (existing.file_path) {
            await supabase.storage
              .from('certificates')
              .remove([existing.file_path]);
          }

          const { error: uploadError } = await supabase.storage
            .from('certificates')
            .upload(filePath, file);
          
          if (uploadError) throw uploadError;
          
          updateData.file_path = filePath;
          updateData.file_name = file.name;
          updateData.file_type = file.type;
          updateData.file_size = file.size;
        }
      }

      const { data: certificate, error } = await supabase
        .from('certificates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync certificate_expiry to equipment if expiry_date changed
      if (data.expiry_date && certificate.equipment_id) {
        await supabase
          .from('equipment')
          .update({ certificate_expiry: data.expiry_date })
          .eq('id', certificate.equipment_id);
      }

      return certificate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('certificates.updateSuccess'));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.updateError'), {
        description: error.message,
      });
    },
  });
}

export function useRenewCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      certificateId,
      newExpiryDate,
      notes,
      file,
    }: {
      certificateId: string;
      newExpiryDate: string;
      notes?: string;
      file?: File;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Get current certificate
      const { data: current, error: fetchError } = await supabase
        .from('certificates')
        .select('*')
        .eq('id', certificateId)
        .single();

      if (fetchError) throw fetchError;

      let newFilePath: string | null = null;

      // Upload new file if provided
      if (file && current.organization_id) {
        const timestamp = Date.now();
        newFilePath = `${current.organization_id}/${current.equipment_id}/${timestamp}_${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('certificates')
          .upload(newFilePath, file);
        
        if (uploadError) throw uploadError;
      }

      // Create renewal record
      const { error: renewalError } = await supabase
        .from('certificate_renewals')
        .insert({
          certificate_id: certificateId,
          previous_expiry_date: current.expiry_date,
          new_expiry_date: newExpiryDate,
          renewed_by: user?.id,
          old_file_path: current.file_path,
          new_file_path: newFilePath,
          notes,
        });

      if (renewalError) throw renewalError;

      // Update certificate
      const updateData: Record<string, unknown> = {
        expiry_date: newExpiryDate,
        last_renewal_date: new Date().toISOString().split('T')[0],
        renewal_status: 'completed',
        renewal_notes: notes,
        renewed_by: user?.id,
      };

      if (newFilePath) {
        updateData.file_path = newFilePath;
        updateData.file_name = file?.name;
        updateData.file_type = file?.type;
        updateData.file_size = file?.size;
      }

      const { data: updated, error: updateError } = await supabase
        .from('certificates')
        .update(updateData)
        .eq('id', certificateId)
        .select()
        .single();

      if (updateError) throw updateError;

      // Sync certificate_expiry to equipment
      if (current.equipment_id) {
        await supabase
          .from('equipment')
          .update({ certificate_expiry: newExpiryDate })
          .eq('id', current.equipment_id);
      }

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-renewals'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('certificates.renewSuccess'));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.renewError'), {
        description: error.message,
      });
    },
  });
}

export function useDeleteCertificate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Get certificate to delete file
      const { data: certificate } = await supabase
        .from('certificates')
        .select('file_path')
        .eq('id', id)
        .single();

      // Delete file if exists
      if (certificate?.file_path) {
        await supabase.storage
          .from('certificates')
          .remove([certificate.file_path]);
      }

      const { error } = await supabase
        .from('certificates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast.success(i18n.t('certificates.deleteSuccess'));
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.deleteError'), {
        description: error.message,
      });
    },
  });
}

export function useCertificateRenewals(certificateId: string | undefined) {
  return useQuery({
    queryKey: ['certificate-renewals', certificateId],
    queryFn: async () => {
      if (!certificateId) return [];

      const { data, error } = await supabase
        .from('certificate_renewals')
        .select('*')
        .eq('certificate_id', certificateId)
        .order('renewed_at', { ascending: false });

      if (error) throw error;
      return data as CertificateRenewal[];
    },
    enabled: !!certificateId,
  });
}

export function useCertificateFileUrl(filePath: string | undefined) {
  return useQuery({
    queryKey: ['certificate-file-url', filePath],
    queryFn: async () => {
      if (!filePath) return null;

      const { data } = await supabase.storage
        .from('certificates')
        .createSignedUrl(filePath, 3600);

      return data?.signedUrl || null;
    },
    enabled: !!filePath,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
