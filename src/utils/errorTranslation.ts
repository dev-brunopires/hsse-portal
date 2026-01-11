/**
 * Utility to translate technical database/API errors into user-friendly messages
 * Centralizes error handling to provide consistent, non-technical feedback
 */

import i18n from '@/i18n';

interface ErrorPattern {
  pattern: RegExp;
  key: string;
}

// Map of technical error patterns to translation keys
const errorPatterns: ErrorPattern[] = [
  // Duplicate key violations
  { pattern: /duplicate key.*equipment_internal_code/i, key: 'errors.duplicateEquipmentCode' },
  { pattern: /duplicate key.*equipment_serial_number/i, key: 'errors.duplicateSerialNumber' },
  { pattern: /duplicate key.*equipment_short_code/i, key: 'errors.duplicateShortCode' },
  { pattern: /duplicate key.*categories_name/i, key: 'errors.duplicateCategoryName' },
  { pattern: /duplicate key.*ships_name/i, key: 'errors.duplicateShipName' },
  { pattern: /duplicate key.*ships_code/i, key: 'errors.duplicateShipCode' },
  { pattern: /duplicate key.*user_ships/i, key: 'errors.duplicateUserShip' },
  { pattern: /duplicate key.*profiles_email/i, key: 'errors.duplicateEmail' },
  { pattern: /duplicate key.*unique_constraint/i, key: 'errors.duplicateRecord' },
  { pattern: /duplicate key/i, key: 'errors.duplicateRecord' },
  
  // Foreign key violations
  { pattern: /foreign key.*equipment_id/i, key: 'errors.equipmentInUse' },
  { pattern: /foreign key.*category_id/i, key: 'errors.categoryInUse' },
  { pattern: /foreign key.*ship_id/i, key: 'errors.shipInUse' },
  { pattern: /foreign key.*user_id/i, key: 'errors.userInUse' },
  { pattern: /violates foreign key constraint/i, key: 'errors.recordInUse' },
  
  // RLS violations
  { pattern: /row.level security/i, key: 'errors.accessDenied' },
  { pattern: /new row violates row-level security policy/i, key: 'errors.accessDenied' },
  { pattern: /permission denied/i, key: 'errors.accessDenied' },
  
  // Not found errors
  { pattern: /PGRST116/i, key: 'errors.recordNotFound' },
  { pattern: /no rows returned/i, key: 'errors.recordNotFound' },
  
  // Authentication errors
  { pattern: /Invalid login credentials/i, key: 'errors.invalidCredentials' },
  { pattern: /Email not confirmed/i, key: 'errors.emailNotConfirmed' },
  { pattern: /User not found/i, key: 'errors.userNotFound' },
  { pattern: /JWT expired/i, key: 'errors.sessionExpired' },
  { pattern: /token.*expired/i, key: 'errors.sessionExpired' },
  { pattern: /invalid.*token/i, key: 'errors.invalidSession' },
  
  // Required field errors
  { pattern: /null value.*not-null constraint/i, key: 'errors.requiredFieldMissing' },
  { pattern: /violates not-null constraint/i, key: 'errors.requiredFieldMissing' },
  
  // Network errors
  { pattern: /Failed to fetch/i, key: 'errors.networkError' },
  { pattern: /network.*error/i, key: 'errors.networkError' },
  { pattern: /ERR_NETWORK/i, key: 'errors.networkError' },
  { pattern: /ERR_INTERNET_DISCONNECTED/i, key: 'errors.noInternet' },
  { pattern: /offline/i, key: 'errors.noInternet' },
  
  // File upload errors
  { pattern: /file.*too large/i, key: 'errors.fileTooLarge' },
  { pattern: /payload.*too large/i, key: 'errors.fileTooLarge' },
  { pattern: /invalid.*file/i, key: 'errors.invalidFile' },
  { pattern: /storage.*error/i, key: 'errors.uploadFailed' },
  
  // Timeout errors
  { pattern: /timeout/i, key: 'errors.timeout' },
  { pattern: /ETIMEDOUT/i, key: 'errors.timeout' },
  
  // Server errors
  { pattern: /500/i, key: 'errors.serverError' },
  { pattern: /internal server error/i, key: 'errors.serverError' },
  { pattern: /502|503|504/i, key: 'errors.serviceUnavailable' },
  
  // Organization errors
  { pattern: /Organização não encontrada/i, key: 'errors.organizationNotFound' },
  { pattern: /Organization not found/i, key: 'errors.organizationNotFound' },
  
  // Check constraint violations
  { pattern: /check constraint/i, key: 'errors.invalidData' },
  { pattern: /violates check constraint/i, key: 'errors.invalidData' },
];

/**
 * Translates a technical error message into a user-friendly message
 * @param error - The error object or message
 * @returns Translated user-friendly message
 */
export function translateError(error: Error | string | unknown): string {
  let errorMessage = '';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    return i18n.t('errors.unknownError');
  }
  
  // Check each pattern for a match
  for (const { pattern, key } of errorPatterns) {
    if (pattern.test(errorMessage)) {
      return i18n.t(key);
    }
  }
  
  // If no pattern matches, return a generic error
  // But still try to make it somewhat user-friendly
  if (errorMessage.includes('supabase') || errorMessage.includes('postgres')) {
    return i18n.t('errors.databaseError');
  }
  
  // Return generic error for truly unknown errors
  return i18n.t('errors.genericError');
}

/**
 * Gets both a title and description for an error
 * Useful for toast notifications
 */
export function getErrorDetails(error: Error | string | unknown, fallbackTitle?: string): {
  title: string;
  description: string;
} {
  const translatedMessage = translateError(error);
  
  return {
    title: fallbackTitle || i18n.t('errors.errorTitle'),
    description: translatedMessage,
  };
}
