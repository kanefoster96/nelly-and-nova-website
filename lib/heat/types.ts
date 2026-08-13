/**
 * Severe heat days.
 * -----------------
 * A trainer marks a date as too hot to walk dogs in the midday sun. On a heat
 * day the collection and drop-off times shift earlier so dogs are only out in
 * the cool of the morning and later afternoon. Everyone with a session that day
 * is notified, and their profile's "Your next session" card flags the change.
 */
export type HeatDay = {
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO
};

/** Earlier collection/drop-off on a heat day (vs the usual 7:30am / 4:00pm). */
export const HEAT_COLLECTION = "Collection from 6:00am";
export const HEAT_DROPOFF = "Drop-off from 2:00pm";
