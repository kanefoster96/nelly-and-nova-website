/**
 * Data-access seam for editing dog details (admin).
 * Intended backend (Supabase):
 *   - saveDogDetails(id, details) → update `dogs` set ... where id = $1 (RLS: staff)
 */
export type DogDetails = {
  name: string;
  owner: string;
  breed: string;
  age: string;
  notes: string;
};

export async function saveDogDetails(
  id: string,
  details: Partial<DogDetails>
): Promise<void> {
  // TODO(backend): update dogs set name=$, owner_name=$, breed=$, age=$, notes=$
  console.log(`[dogs] saved details for ${id}`, details, "(scaffold)");
}
