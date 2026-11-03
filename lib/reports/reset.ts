"use client";

/**
 * Homework resets — live (homework_resets).
 * -----------------------------------------
 * A trainer can reset a dog's homework completion to 100% — offered when the
 * owner books a 1-1 so missed homework can be worked through together. We store
 * the reset moment per dog; completion is then measured only from report cards
 * dated on or after it.
 */
import { useReports, resetHomework } from "./client";

type Resets = Record<string, string>; // dogId → ISO reset timestamp

/** Reset a dog's homework to 100% as of now. */
export function resetDogHomework(dogId: string): Promise<void> {
  return resetHomework(dogId);
}

export function resetAtFor(resets: Resets, dogId: string | undefined): string | undefined {
  return dogId ? resets[dogId] : undefined;
}

export function useHomeworkResets(): Resets {
  return useReports().resets;
}
