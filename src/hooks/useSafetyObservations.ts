import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SafetyRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type SafetySeverity = 'low' | 'medium' | 'high' | 'critical';
export type SafetyLikelihood = 'unlikely' | 'possible' | 'likely' | 'very_likely';
export type SafetyCardTemplate = 'bco' | 'psf';

export type TemplateChecklistStatus = 'safe' | 'unsafe' | 'not_applicable';
export type TemplateChecklist = Record<string, TemplateChecklistStatus>;
export type TemplateFlags = Record<string, boolean>;

export interface CreateSafetyObservationInput {
  organization_id?: string | null;
  ship_id: string;
  area: string;
  card_template: SafetyCardTemplate;
  observer_name?: string | null;
  observer_department?: string | null;
  observer_id: string;
  observed_at: string;
  shift?: string | null;
  activity_type: string;
  observation_type: string;
  risk_category: string;
  energy_source?: string | null;
  people_exposed?: number | null;
  potential_consequence: string;
  severity: SafetySeverity;
  likelihood: SafetyLikelihood;
  risk_level: SafetyRiskLevel;
  residual_risk_level?: SafetyRiskLevel | null;
  stop_work: boolean;
  fatality_potential: boolean;
  description: string;
  risk_perception: string;
  immediate_action: string;
  person_notified?: string | null;
  recommended_action?: string | null;
  responsible_name?: string | null;
  due_date?: string | null;
  requires_followup: boolean;
  requires_cmms: boolean;
  requires_investigation: boolean;
  share_in_tbt: boolean;
  nominated_good_card: boolean;
  learning?: string | null;
  location_options: TemplateFlags;
  behaviour_checks: TemplateChecklist;
  condition_checks: TemplateChecklist;
  equipment_checks: TemplateChecklist;
  operating_mode?: string | null;
  manager_site_visit: boolean;
  work_order_required: boolean;
  weeps_seeps: Record<string, unknown>;
  leak_locations: TemplateFlags;
  main_causes: TemplateFlags;
  process_safety_safeguards: TemplateChecklist;
  process_safety_fundamentals: TemplateChecklist;
}

export interface SafetyObservation extends CreateSafetyObservationInput {
  id: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface SafetyObservationWithShip extends SafetyObservation {
  ships?: {
    name: string;
    code: string | null;
  } | null;
}

export interface UpdateSafetyObservationInput {
  id: string;
  status?: SafetyObservation['status'];
  recommended_action?: string | null;
  responsible_name?: string | null;
  due_date?: string | null;
  residual_risk_level?: SafetyRiskLevel | null;
  learning?: string | null;
  requires_followup?: boolean;
  requires_cmms?: boolean;
  requires_investigation?: boolean;
  share_in_tbt?: boolean;
}

type SafetyObservationUpdatePayload = Omit<UpdateSafetyObservationInput, 'id'>;

interface InsertQuery<T> extends PromiseLike<{ data: T | null; error: { message: string } | null }> {
  select: (columns?: string) => InsertQuery<T>;
  single: () => InsertQuery<T>;
}

interface SelectQuery<T> extends PromiseLike<{ data: T[] | null; error: { message: string } | null }> {
  select: (columns?: string) => SelectQuery<T>;
  order: (column: string, options?: { ascending?: boolean }) => SelectQuery<T>;
  limit: (count: number) => SelectQuery<T>;
}

interface UpdateQuery<T> extends PromiseLike<{ data: T | null; error: { message: string } | null }> {
  update: (value: SafetyObservationUpdatePayload) => UpdateQuery<T>;
  eq: (column: string, value: string) => UpdateQuery<T>;
  select: (columns?: string) => UpdateQuery<T>;
  single: () => UpdateQuery<T>;
}

interface DeleteQuery extends PromiseLike<{ error: { message: string } | null }> {
  delete: () => DeleteQuery;
  eq: (column: string, value: string) => DeleteQuery;
}

const safetyObservationDb = supabase as unknown as {
  from: <T = unknown>(table: 'safety_observations') => {
    insert: (value: CreateSafetyObservationInput) => InsertQuery<T>;
    select: (columns?: string) => SelectQuery<T>;
    update: (value: SafetyObservationUpdatePayload) => UpdateQuery<T>;
    delete: () => DeleteQuery;
  };
};

const SAFETY_OBSERVATION_SELECT = `
  *,
  ships:ship_id (
    name,
    code
  )
`;

export function useSafetyObservations() {
  return useQuery({
    queryKey: ['safety-observations'],
    queryFn: async () => {
      const { data, error } = await safetyObservationDb
        .from<SafetyObservationWithShip>('safety_observations')
        .select(SAFETY_OBSERVATION_SELECT)
        .order('observed_at', { ascending: false })
        .limit(300);

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateSafetyObservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSafetyObservationInput) => {
      const { data, error } = await safetyObservationDb
        .from<SafetyObservation>('safety_observations')
        .insert(input)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Observacao nao retornada pelo banco.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-observations'] });
    },
  });
}

export function useUpdateSafetyObservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateSafetyObservationInput) => {
      const { id, ...updates } = input;
      const { data, error } = await safetyObservationDb
        .from<SafetyObservation>('safety_observations')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error('Observacao nao retornada pelo banco.');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-observations'] });
    },
  });
}

export function useDeleteSafetyObservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await safetyObservationDb
        .from('safety_observations')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-observations'] });
    },
  });
}
