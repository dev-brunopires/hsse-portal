import { supabase } from '@/integrations/supabase/client';
import { getCurrentOrganizationId, generateEquipmentDocumentPath, generateInspectionPhotoPath } from '@/utils/storageHelpers';

export async function uploadEquipmentDocument(
  equipmentId: string,
  file: File,
  uploadedBy: string
) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization not found');
  }

  const fileName = generateEquipmentDocumentPath(organizationId, equipmentId, file.name);
  
  const { error: uploadError } = await supabase.storage
    .from('equipment-documents')
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;

  const { error: recordError } = await supabase
    .from('equipment_documents')
    .insert({
      equipment_id: equipmentId,
      file_name: file.name,
      file_path: fileName,
      file_type: file.type,
      file_size: file.size,
      uploaded_by: uploadedBy,
    });
  
  if (recordError) throw recordError;

  return fileName;
}

export async function uploadInspectionPhoto(
  inspectionId: string,
  file: File
) {
  const organizationId = await getCurrentOrganizationId();
  if (!organizationId) {
    throw new Error('Organization not found');
  }

  const fileName = generateInspectionPhotoPath(organizationId, inspectionId, file.name);
  
  const { error: uploadError } = await supabase.storage
    .from('inspection-photos')
    .upload(fileName, file);
  
  if (uploadError) throw uploadError;

  const { error: recordError } = await supabase
    .from('inspection_photos')
    .insert({
      inspection_id: inspectionId,
      file_name: file.name,
      file_path: fileName,
    });
  
  if (recordError) throw recordError;

  return fileName;
}

export function getEquipmentDocumentUrl(filePath: string) {
  const { data } = supabase.storage
    .from('equipment-documents')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

export function getInspectionPhotoUrl(filePath: string) {
  const { data } = supabase.storage
    .from('inspection-photos')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

export async function getSignedUrl(bucket: string, filePath: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 3600); // 1 hour expiry
  
  if (error) throw error;
  return data.signedUrl;
}
