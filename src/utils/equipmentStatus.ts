/**
 * Utility to calculate the effective status of equipment
 * Equipment is considered "rejected" if:
 * - Certificate is expired
 * - Equipment expiry date (hydrostatic test, etc.) has passed
 * - Stored status is already "rejected" or "expired"
 */
import { getLocalToday, formatLocalDate } from '@/utils/dateFormat';

export type BlockingExpiryField = 'certificate_expiry' | 'expiry_date' | 'next_hydrostatic_test' | 'next_calibration';

export interface EquipmentWithDates {
  status: string;
  certificate_expiry?: string | null;
  expiry_date?: string | null;
  next_inspection?: string | null;
  next_hydrostatic_test?: string | null;
  next_calibration?: string | null;
  // Optional category blocking config (defaults to certificate + expiry)
  category_blocking_expiries?: BlockingExpiryField[] | null;
}

export interface EffectiveStatusResult {
  effectiveStatus: 'active' | 'maintenance' | 'rejected' | 'expired' | 'inactive';
  isAutoRejected: boolean;
  reasons: string[];
  reasonKeys: string[];
}

export interface EquipmentAlerts {
  hasCertificateExpired: boolean;
  hasCertificateExpiringSoon: boolean;
  hasEquipmentExpired: boolean;
  hasInspectionOverdue: boolean;
  hasInspectionDueSoon: boolean;
  hasHydroExpired?: boolean;
  hasHydroExpiringSoon?: boolean;
  hasCalibrationExpired?: boolean;
  hasCalibrationExpiringSoon?: boolean;
  alertCount: number;
  alertKeys: string[];
}

const DEFAULT_BLOCKING: BlockingExpiryField[] = ['certificate_expiry', 'expiry_date'];

export function getEffectiveEquipmentStatus(equipment: EquipmentWithDates): EffectiveStatusResult {
  const today = getLocalToday();
  const reasons: string[] = [];
  const reasonKeys: string[] = [];
  let isAutoRejected = false;

  const blocking = equipment.category_blocking_expiries ?? DEFAULT_BLOCKING;

  if (blocking.includes('certificate_expiry') && equipment.certificate_expiry && equipment.certificate_expiry < today) {
    reasons.push('Certificado vencido');
    reasonKeys.push('alerts.msgCertificateExpired');
    isAutoRejected = true;
  }

  if (blocking.includes('expiry_date') && equipment.expiry_date && equipment.expiry_date < today) {
    reasons.push('Validade do equipamento vencida');
    reasonKeys.push('alerts.msgHydrostaticExpired');
    isAutoRejected = true;
  }

  if (blocking.includes('next_hydrostatic_test') && equipment.next_hydrostatic_test && equipment.next_hydrostatic_test < today) {
    reasons.push('Teste hidrostático vencido');
    reasonKeys.push('alerts.msgHydroTestExpired');
    isAutoRejected = true;
  }

  if (blocking.includes('next_calibration') && equipment.next_calibration && equipment.next_calibration < today) {
    reasons.push('Calibração vencida');
    reasonKeys.push('alerts.msgCalibrationExpired');
    isAutoRejected = true;
  }

  if (isAutoRejected) {
    return { effectiveStatus: 'rejected', isAutoRejected: true, reasons, reasonKeys };
  }

  return {
    effectiveStatus: equipment.status as EffectiveStatusResult['effectiveStatus'],
    isAutoRejected: false,
    reasons: [],
    reasonKeys: []
  };
}

/**
 * Get all alerts for an equipment item
 * Used in reports to show notifications alongside status
 */
export function getEquipmentAlerts(equipment: EquipmentWithDates): EquipmentAlerts {
  const todayStr = getLocalToday();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const thirtyDaysStr = formatLocalDate(thirtyDaysFromNow);
  
  const alertKeys: string[] = [];
  
  // Certificate expired
  const hasCertificateExpired = !!(equipment.certificate_expiry && equipment.certificate_expiry < todayStr);
  if (hasCertificateExpired) {
    alertKeys.push('alerts.certificateExpired');
  }
  
  // Certificate expiring soon (within 30 days)
  const hasCertificateExpiringSoon = !!(
    equipment.certificate_expiry && 
    equipment.certificate_expiry >= todayStr && 
    equipment.certificate_expiry <= thirtyDaysStr
  );
  if (hasCertificateExpiringSoon) {
    alertKeys.push('alerts.certificateExpiring');
  }
  
  // Equipment expired
  const hasEquipmentExpired = !!(equipment.expiry_date && equipment.expiry_date < todayStr);
  if (hasEquipmentExpired) {
    alertKeys.push('alerts.equipmentExpired');
  }
  
  // Inspection overdue
  const hasInspectionOverdue = !!(equipment.next_inspection && equipment.next_inspection < todayStr);
  if (hasInspectionOverdue) {
    alertKeys.push('alerts.inspectionOverdue');
  }
  
  // Inspection due soon (within 30 days)
  const hasInspectionDueSoon = !!(
    equipment.next_inspection && 
    equipment.next_inspection >= todayStr && 
    equipment.next_inspection <= thirtyDaysStr
  );
  if (hasInspectionDueSoon) {
    alertKeys.push('alerts.inspectionDueSoon');
  }
  
  return {
    hasCertificateExpired,
    hasCertificateExpiringSoon,
    hasEquipmentExpired,
    hasInspectionOverdue,
    hasInspectionDueSoon,
    alertCount: alertKeys.length,
    alertKeys
  };
}

/**
 * Format status with alerts for display in reports
 */
export function formatStatusWithAlerts(
  status: string,
  equipment: EquipmentWithDates,
  statusLabels: Record<string, string>,
  alertLabels: {
    certificateExpired?: string;
    certificateExpiring?: string;
    equipmentExpired?: string;
    inspectionOverdue?: string;
    inspectionDueSoon?: string;
  }
): string {
  const alerts = getEquipmentAlerts(equipment);
  const effectiveResult = getEffectiveEquipmentStatus(equipment);
  
  // Use effective status
  let statusText = statusLabels[effectiveResult.effectiveStatus] || status;
  
  // Build alert indicators
  const alertIndicators: string[] = [];
  
  if (alerts.hasCertificateExpired) {
    alertIndicators.push(alertLabels.certificateExpired || 'Cert. Vencido');
  } else if (alerts.hasCertificateExpiringSoon) {
    alertIndicators.push(alertLabels.certificateExpiring || 'Cert. a Vencer');
  }
  
  if (alerts.hasEquipmentExpired) {
    alertIndicators.push(alertLabels.equipmentExpired || 'Validade Vencida');
  }
  
  if (alerts.hasInspectionOverdue) {
    alertIndicators.push(alertLabels.inspectionOverdue || 'Inspeção Atrasada');
  } else if (alerts.hasInspectionDueSoon) {
    alertIndicators.push(alertLabels.inspectionDueSoon || 'Inspeção Próxima');
  }
  
  if (alertIndicators.length > 0) {
    return `${statusText} | ${alertIndicators.join(' | ')}`;
  }
  
  return statusText;
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
