import { supabase } from '@/integrations/supabase/client';

/**
 * Gets the organization ID for the current user
 * Used to prefix file paths in storage buckets for multi-tenant isolation
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('user_id', user.id)
    .single();

  return profile?.organization_id || null;
}

/**
 * Generates a file path prefixed with organization ID for multi-tenant storage isolation
 * Format: {organization_id}/{entity_id}/{timestamp}-{filename}
 */
export function generateStoragePath(
  organizationId: string,
  entityId: string,
  fileName: string
): string {
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${organizationId}/${entityId}/${Date.now()}-${sanitizedFileName}`;
}

/**
 * Generates a file path for equipment documents
 */
export function generateEquipmentDocumentPath(
  organizationId: string,
  equipmentId: string,
  fileName: string
): string {
  return generateStoragePath(organizationId, equipmentId, fileName);
}

/**
 * Generates a file path for inspection photos
 */
export function generateInspectionPhotoPath(
  organizationId: string,
  inspectionId: string,
  fileName: string
): string {
  return generateStoragePath(organizationId, inspectionId, fileName);
}

/**
 * Generates a file path for maintenance photos
 */
export function generateMaintenancePhotoPath(
  organizationId: string,
  maintenanceRequestId: string,
  fileName: string
): string {
  return generateStoragePath(organizationId, maintenanceRequestId, fileName);
}

/**
 * Generates a file path for user avatars
 * Format: {user_id}/{timestamp}-avatar.{ext}
 * Note: Avatars are user-specific, not organization-specific
 */
export function generateAvatarPath(
  userId: string,
  fileName: string
): string {
  const ext = fileName.split('.').pop() || 'jpg';
  return `${userId}/${Date.now()}-avatar.${ext}`;
}

/**
 * Generates a file path for organization logos
 * Format: {organization_id}/{type}_{timestamp}.{ext}
 */
export function generateOrganizationLogoPath(
  organizationId: string,
  type: 'logo' | 'logo_white',
  fileName: string
): string {
  const ext = fileName.split('.').pop() || 'png';
  return `${organizationId}/${type}_${Date.now()}.${ext}`;
}
