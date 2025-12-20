export type EquipmentStatus = 'active' | 'maintenance' | 'rejected' | 'expired' | 'inactive';

export type InspectionFrequency = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'custom';

export interface EquipmentCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  inspectionFrequency: InspectionFrequency;
  customFields: CustomField[];
}

export interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  options?: string[];
}

export interface Equipment {
  id: string;
  internalCode: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  category?: string;
  type: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  capacity?: string;
  unit: string;
  location: string;
  status: EquipmentStatus;
  manufacturingDate: string;
  acquisitionDate: string;
  expiryDate: string;
  certificateExpiry: string;
  lastInspection: string;
  nextInspection: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Inspection {
  id: string;
  equipmentId: string;
  inspectorId: string;
  inspectorName: string;
  date: string;
  status: 'compliant' | 'attention' | 'non-compliant';
  checklistItems: ChecklistItem[];
  observations: string;
  evidences: string[];
}

export interface ChecklistItem {
  id: string;
  description: string;
  status: 'ok' | 'attention' | 'fail';
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'technician' | 'viewer';
  unit: string;
  avatar?: string;
}

export interface DashboardStats {
  totalEquipment: number;
  activeEquipment: number;
  expiredEquipment: number;
  expiredCertificates: number;
  pendingInspections: number;
  complianceRate: number;
  byCategory: CategoryStats[];
  byStatus: StatusStats[];
  recentAlerts: Alert[];
  // Maintenance stats
  pendingMaintenance: number;
  overdueMaintenance: number;
  inProgressMaintenance: number;
}

export interface CategoryStats {
  category: string;
  count: number;
  compliant: number;
  nonCompliant: number;
}

export interface StatusStats {
  status: EquipmentStatus;
  count: number;
}

export interface Alert {
  id: string;
  type: 'expired' | 'expiring' | 'inspection_due' | 'non_compliant' | 'maintenance_overdue' | 'maintenance_pending';
  message: string;
  equipmentId: string;
  equipmentName: string;
  date: string;
  severity: 'low' | 'medium' | 'high';
  maintenanceId?: string;
}
