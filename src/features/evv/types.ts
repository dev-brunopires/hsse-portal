import type { EvvFormType, Rating } from './catalog';

export type EvvStatus = 'draft' | 'completed' | 'not_synced';

export interface EvvScope {
  environment: 'fpso' | 'project' | 'office' | '';
  location_id: string;
  vessel_id: string;
  department: 'cargo' | 'production' | 'brownfield' | '';
  your_organization: 'sbm' | 'contractor' | 'client' | '';
  your_role: 'first_line_supervisor' | 'onshore_manager' | 'senior_manager' | 'admin' | '';
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
  client_id: string; // local uuid for idempotency
  id?: string;
  form_type: EvvFormType;
  status: EvvStatus;
  scope: EvvScope;
  answers: EvvAnswers;
  comments: string;
  submitted_at?: string;
  updated_at: string;
}

export interface EvvLocation {
  id: string;
  name: string;
}

export interface EvvVessel {
  id: string;
  location_id: string;
  name: string;
}
