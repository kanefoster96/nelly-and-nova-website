/**
 * Skills backend seam (scaffold). The store calls this when a trainer toggles a
 * skill; today it just logs. TODO(backend): upsert into `dog_skills`
 * (dog_id, skill_id, learnt, updated_by) — trainer-only via RLS.
 */
export async function saveSkill(dogId: string, drillId: string, learnt: boolean) {
  console.log(
    `[skills] ${dogId} · ${drillId} → ${learnt ? "learnt" : "to learn"} (not persisted, scaffold)`
  );
}
