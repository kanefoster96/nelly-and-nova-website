/**
 * Data-access seam for the dog profile (server).
 * ----------------------------------------------
 * Report cards, homework and resets are live in Supabase and read in the
 * browser (lib/reports/client.ts), so Row Level Security decides what each
 * account sees. What's left here is the profile's training plan, which still
 * comes from the sample until the schedule is wired up.
 */
import type { DogProfile } from "./types";
import { sampleDog } from "./sample";

export async function getDogProfile(): Promise<DogProfile> {
  // TODO(backend): the plan comes from the schedule once that's live.
  return sampleDog;
}
