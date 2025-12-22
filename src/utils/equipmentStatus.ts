/**
 * Utility to calculate the effective status of equipment
 * Equipment is considered "rejected" if:
 * - Certificate is expired
 * - Equipment expiry date (hydrostatic test, etc.) has passed
 * - Stored status is already "rejected" or "expired"
 */

export interface EquipmentWithDates {
  status: string;
  certificate_expiry?: string | null;
  expiry_date?: string | null;
  next_inspection?: string | null;
}

export interface EffectiveStatusResult {
  effectiveStatus: 'active' | 'maintenance' | 'rejected' | 'expired' | 'inactive';
  isAutoRejected: boolean;
  reasons: string[];
  reasonKeys: string[]; // i18n keys for translation
}

export function getEffectiveEquipmentStatus(equipment: EquipmentWithDates): EffectiveStatusResult {
  const today = new Date().toISOString().split('T')[0];
  const reasons: string[] = [];
  const reasonKeys: string[] = [];
  let isAutoRejected = false;
  
  // Check certificate expiry
  const isCertificateExpired = !!(equipment.certificate_expiry && equipment.certificate_expiry < today);
  if (isCertificateExpired) {
    reasons.push('Certificado vencido'); // Fallback for non-i18n contexts
    reasonKeys.push('alerts.msgCertificateExpired');
    isAutoRejected = true;
  }
  
  // Check equipment expiry (hydrostatic test, etc.)
  const isEquipmentExpired = !!(equipment.expiry_date && equipment.expiry_date < today);
  if (isEquipmentExpired) {
    reasons.push('Teste hidrostático/validade vencida'); // Fallback for non-i18n contexts
    reasonKeys.push('alerts.msgHydrostaticExpired');
    isAutoRejected = true;
  }
  
  // If auto-rejected due to expiry, return rejected status
  if (isAutoRejected) {
    return {
      effectiveStatus: 'rejected',
      isAutoRejected: true,
      reasons,
      reasonKeys
    };
  }
  
  // Otherwise, return the stored status
  return {
    effectiveStatus: equipment.status as EffectiveStatusResult['effectiveStatus'],
    isAutoRejected: false,
    reasons: [],
    reasonKeys: []
  };
}

export function getEffectiveStatusLabel(effectiveStatus: string): string {
  const labels: Record<string, string> = {
    active: 'Ativo',
    maintenance: 'Em Manutenção',
    rejected: 'Reprovado',
    expired: 'Vencido',
    inactive: 'Inativo'
  };
  return labels[effectiveStatus] || effectiveStatus;
}

export function getEffectiveStatusColor(effectiveStatus: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-500',
    maintenance: 'bg-yellow-500',
    rejected: 'bg-red-500',
    expired: 'bg-red-500',
    inactive: 'bg-gray-500'
  };
  return colors[effectiveStatus] || 'bg-gray-500';
}
