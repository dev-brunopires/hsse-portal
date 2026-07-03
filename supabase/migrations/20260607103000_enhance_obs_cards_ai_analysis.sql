-- Enhance OBS Cards AI classification with specialist HSSE analysis fields.

ALTER TABLE public.obs_cards
  ADD COLUMN IF NOT EXISTS ai_status_assessment text,
  ADD COLUMN IF NOT EXISTS ai_status_alignment text,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric(4,3),
  ADD COLUMN IF NOT EXISTS ai_criticality_score integer,
  ADD COLUMN IF NOT EXISTS ai_requires_followup boolean,
  ADD COLUMN IF NOT EXISTS ai_action_quality text,
  ADD COLUMN IF NOT EXISTS ai_barrier_failure text,
  ADD COLUMN IF NOT EXISTS ai_recommended_action text;

CREATE INDEX IF NOT EXISTS idx_obs_cards_ai_status_assessment
  ON public.obs_cards(ai_status_assessment);

CREATE INDEX IF NOT EXISTS idx_obs_cards_ai_status_alignment
  ON public.obs_cards(ai_status_alignment);

CREATE INDEX IF NOT EXISTS idx_obs_cards_ai_criticality_score
  ON public.obs_cards(ai_criticality_score);

CREATE INDEX IF NOT EXISTS idx_obs_cards_ai_requires_followup
  ON public.obs_cards(ai_requires_followup);
