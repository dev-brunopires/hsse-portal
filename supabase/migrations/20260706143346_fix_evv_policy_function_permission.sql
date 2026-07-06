-- RLS expressions execute as the calling role. The function remains in the
-- unexposed private schema and only returns a boolean authorization decision.
grant usage on schema private to authenticated;
grant execute on function private.can_review_evv(uuid, uuid, jsonb) to authenticated;
