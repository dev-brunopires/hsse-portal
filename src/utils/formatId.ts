/**
 * Utility functions to format IDs in a user-friendly way
 * Instead of full UUIDs, we use short prefixed codes
 */

export type IdPrefix = 'INS' | 'MNT' | 'EQP' | 'SHP' | 'CAT' | 'USR';

/**
 * Formats a UUID to a short readable code
 * Example: "abc12345-def6-7890-ghij-klmnopqrstuv" -> "INS-ABC12"
 * @param id - The full UUID
 * @param prefix - The prefix to use (INS, MNT, EQP, etc.)
 * @param length - Number of characters to use from the UUID (default: 6)
 */
export function formatShortId(id: string, prefix: IdPrefix, length: number = 6): string {
  if (!id) return '—';
  const shortPart = id.replace(/-/g, '').substring(0, length).toUpperCase();
  return `${prefix}-${shortPart}`;
}

/**
 * Formats an inspection ID
 * Example: "abc12345-..." -> "INS-ABC123"
 */
export function formatInspectionId(id: string): string {
  return formatShortId(id, 'INS');
}

/**
 * Formats a maintenance request ID
 * Example: "abc12345-..." -> "MNT-ABC123"
 */
export function formatMaintenanceId(id: string): string {
  return formatShortId(id, 'MNT');
}

/**
 * Formats an equipment ID (use internal_code when available)
 * Falls back to short UUID if no internal_code
 */
export function formatEquipmentId(internalCode?: string | null, id?: string): string {
  if (internalCode) return internalCode;
  if (id) return formatShortId(id, 'EQP');
  return '—';
}

/**
 * Formats a ship ID
 * Example: "abc12345-..." -> "SHP-ABC123"
 */
export function formatShipId(id: string): string {
  return formatShortId(id, 'SHP');
}

/**
 * Formats a category ID
 * Example: "abc12345-..." -> "CAT-ABC123"
 */
export function formatCategoryId(id: string): string {
  return formatShortId(id, 'CAT');
}

/**
 * Extracts the core ID from a formatted short ID
 * Example: "INS-ABC123" -> "ABC123"
 */
export function extractIdPart(formattedId: string): string {
  const parts = formattedId.split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : formattedId;
}
