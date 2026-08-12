/**
 * Reschedule requests — a member asks to move one upcoming session to another
 * day that has space. The request goes to the admin's requests queue to be
 * approved, edited, rejected or replied to. An approved request becomes an
 * exception applied to that member's session list.
 */
import type { DayId } from "@/lib/schedule/types";

export type RescheduleStatus = "pending" | "approved" | "rejected";

export type RescheduleRequest = {
  id: string;
  dogId: string;
  dogName: string;
  ownerName: string;
  email?: string;
  /** The session being moved. */
  sessionDate: string; // YYYY-MM-DD
  fromDay: DayId;
  /** Where the member wants it (admin may edit before approving). */
  toDay: DayId;
  toDate: string; // YYYY-MM-DD
  note?: string;
  status: RescheduleStatus;
  createdAt: string; // ISO
};
