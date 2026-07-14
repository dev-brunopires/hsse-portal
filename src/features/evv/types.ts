import type { EvvFormType, Rating } from './catalog';

export type EvvStatus = 'draft' | 'completed' | 'not_synced';

export interface EvvScope {
  environment: 'fpso' | 'project' | 'office' | 'yard' | '';
  area: string;
  location: string;
  visit_datetime: string;
  permit_to_work: 'yes' | 'no' | 'na' | '';
  permit_to_work_number?: string;
  critical_activity: 'yes' | 'no' | '';
  critical_activities?: string[];
  vessel_ids: string[];                       // multi-select – from user's assigned ships
  department: string;                          // auto-fill from profile.department (editable)
  your_organization: string;                   // auto-fill from current organization name (read-only)
  your_role: string;                           // auto-fill from user_roles (read-only)
  task_description: string;
  // Extras for Leaders Engagement:
  observed_organization?: 'sbm' | 'contractor' | 'client' | '';
  observed_role?: 'vendor' | 'technician' | 'supervisor' | '';
}

export interface EvvAnswer {
  rating: Rating | null;
  deficiencies: string[];
}

export type EvvAnswers = Record<string /*questionId*/, EvvAnswer>;

export interface EvvSubmission {
  client_id: string;
  id?: string;
  form_type: EvvFormType;
  status: EvvStatus;
  scope: EvvScope;
  answers: EvvAnswers;
  comments: string;
  signature_data?: string | null;
  signed_at?: string | null;
  submitted_at?: string;
  updated_at: string;
}

export interface EvvVessel {
  id: string;
  name: string;
}
