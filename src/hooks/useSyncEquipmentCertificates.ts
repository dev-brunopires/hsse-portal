import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { useOrganization } from '@/contexts/OrganizationContext';

/**
 * Ensures a certificate exists for an equipment with certificate_expiry
 * This is called automatically when equipment is created or updated
 */
export async function ensureCertificateForEquipment(
  equipmentId: string,
  equipmentName: string,
  certificateExpiry: string | null,
  shipId: string | null,
  organizationId: string | null,
  showToast: boolean = true
): Promise<'created' | 'updated' | 'unchanged' | null> {
  // If no certificate_expiry, nothing to sync
  if (!certificateExpiry) return null;

  // If organizationId is not provided, fetch it from the equipment's ship
  let orgId = organizationId;
  if (!orgId && shipId) {
    const { data: ship } = await supabase
      .from('ships')
      .select('organization_id')
      .eq('id', shipId)
      .single();
    orgId = ship?.organization_id || null;
  }

  // If still no org ID, try to get from user profile
  if (!orgId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
      orgId = profile?.organization_id || null;
    }
  }

  // Check if a certificate already exists for this equipment
  const { data: existingCerts, error: checkError } = await supabase
    .from('certificates')
    .select('id, expiry_date')
    .eq('equipment_id', equipmentId);

  if (checkError) throw checkError;

  // If certificate exists, check if we need to update the expiry
  if (existingCerts && existingCerts.length > 0) {
    // Find if any certificate matches the equipment's certificate_expiry
    const matchingCert = existingCerts.find(c => c.expiry_date === certificateExpiry);
    if (matchingCert) {
      // Certificate already exists with correct expiry, nothing to do
      return 'unchanged';
    }
    // Update the first certificate's expiry date
    const { error: updateError } = await supabase
      .from('certificates')
      .update({ expiry_date: certificateExpiry })
      .eq('id', existingCerts[0].id);
    
    if (updateError) throw updateError;
    
    if (showToast) {
      toast.info(i18n.t('certificates.autoSyncUpdated'), {
        description: equipmentName,
      });
    }
    return 'updated';
  }

  // No certificate exists, create one
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error: insertError } = await supabase
    .from('certificates')
    .insert({
      equipment_id: equipmentId,
      ship_id: shipId,
      organization_id: orgId,
      name: `Certificado - ${equipmentName}`,
      type: 'certificate',
      expiry_date: certificateExpiry,
      status: 'valid',
      created_by: user?.id,
    });

  if (insertError) throw insertError;

  if (showToast) {
    toast.success(i18n.t('certificates.autoSyncCreated'), {
      description: equipmentName,
      icon: '✅',
    });
  }
  return 'created';
}

/**
 * Hook to sync all equipment certificates
 * This creates certificates for equipment that have certificate_expiry but no certificate record
 */
export function useSyncAllCertificates() {
  const queryClient = useQueryClient();
  const { organization } = useOrganization();

  return useMutation({
    mutationFn: async () => {
      if (!organization?.id) {
        throw new Error('Organization not found');
      }

      // Get all equipment with certificate_expiry that don't have a certificate
      const { data: equipment, error: equipError } = await supabase
        .from('equipment')
        .select('id, name, certificate_expiry, ship_id')
        .not('certificate_expiry', 'is', null);

      if (equipError) throw equipError;

      if (!equipment || equipment.length === 0) {
        return { synced: 0, total: 0 };
      }

      // Get all existing certificates
      const { data: existingCerts, error: certError } = await supabase
        .from('certificates')
        .select('equipment_id');

      if (certError) throw certError;

      const equipmentWithCerts = new Set(existingCerts?.map(c => c.equipment_id) || []);

      // Filter equipment without certificates
      const equipmentWithoutCerts = equipment.filter(e => !equipmentWithCerts.has(e.id));

      if (equipmentWithoutCerts.length === 0) {
        return { synced: 0, total: equipment.length };
      }

      const { data: { user } } = await supabase.auth.getUser();

      // Create certificates for all equipment without one
      const certificatesToCreate = equipmentWithoutCerts.map(e => ({
        equipment_id: e.id,
        ship_id: e.ship_id,
        organization_id: organization.id,
        name: `Certificado - ${e.name}`,
        type: 'certificate',
        expiry_date: e.certificate_expiry,
        status: 'valid',
        created_by: user?.id,
      }));

      const { error: insertError } = await supabase
        .from('certificates')
        .insert(certificatesToCreate);

      if (insertError) throw insertError;

      return { 
        synced: equipmentWithoutCerts.length, 
        total: equipment.length 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      
      if (result.synced > 0) {
        toast.success(i18n.t('certificates.syncSuccess', { count: result.synced }));
      } else {
        toast.info(i18n.t('certificates.syncNoNew'));
      }
    },
    onError: (error: Error) => {
      toast.error(i18n.t('certificates.syncError'), {
        description: error.message,
      });
    },
  });
}
