/**
 * Reschedule + extra-session requests. A member either moves an existing
 * session to another day, or books an extra session (Walk & Train or 1-1). The
 * request goes to the admin queue to be approved, rejected, or offered a
 * different date. Approving an extra session charges the customer via GoCardless.
 * An approved request becomes an exception applied to that member's schedule.
 */
import type { DayId } from "@/lib/schedule/types";

export type RescheduleStatus = "pending" | "approved" | "rejected" | "suggested";
export type RescheduleKind = "reschedule" | "extra";

export type RescheduleRequest = {
  id: string;
  kind: RescheduleKind;
  /** For extra sessions — "Walk & Train" or "1-1 Training". */
  service?: string;
  dogId: string;
  dogName: string;
  ownerName: string;
  email?: string;
  /** The session being moved (for an extra session this equals toDate). */
  sessionDate: string; // YYYY-MM-DD
  fromDay: DayId;
  /** Target date. For a "suggested" request this is the admin's proposal. */
  toDay: DayId;
  toDate: string; // YYYY-MM-DD
  note?: string;
  status: RescheduleStatus;
  createdAt: string; // ISO
};
