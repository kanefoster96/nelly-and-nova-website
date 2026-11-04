/**
 * What an owner is told when a trainer books them in from a day in the app
 * (app/api/schedule/booked): a 1-1, a Full Day (one-off or regular), or a
 * meet & greet. The one place to change the wording. Styled like every
 * automated notice: one emoji at the start of the title, a friendly
 * message with none.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** "Tue 10 Nov". */
export function shortDay(iso: string): string {
  const d = parts(iso);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Tuesday 10 November". */
export function longDay(iso: string): string {
  const d = parts(iso);
  return `${LONG_DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`;
}

/** "14:00" / "14:00:00" → "2:00pm". */
export function clockTime(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}

/** A timestamp's date and time in London: { date: "2026-11-10", time: "14:00" }. */
export function londonParts(at: string): { date: string; time: string } {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function minutesLabel(min: number | null | undefined): string {
  if (!min) return "";
  if (min % 60 === 0) return min === 60 ? "1 hour" : `${min / 60} hours`;
  return min > 60 ? `${Math.floor(min / 60)} hr ${min % 60} min` : `${min} minutes`;
}

export type Booked =
  | { kind: "one_to_one"; date: string; time: string | null; minutes?: number | null; dog: string }
  | { kind: "full_day_one_off"; date: string; dog: string }
  | { kind: "full_day"; date: string; cadence: "weekly" | "alternating"; dog: string }
  | { kind: "meet_greet"; date: string; time: string; dog: string; address?: string | null };

export function bookedMessage(b: Booked, ownerFirstName: string): { title: string; body: string } {
  const hi = ownerFirstName ? `Hi ${ownerFirstName}!` : "Hi!";
  switch (b.kind) {
    case "one_to_one": {
      const at = b.time ? `, ${clockTime(b.time)}` : "";
      const long = minutesLabel(b.minutes);
      return {
        title: `📅 1-1 booked for ${shortDay(b.date)}${at}`,
        body: `${hi} ${b.dog}'s 1-1 is booked for ${longDay(b.date)}${b.time ? ` at ${clockTime(b.time)}` : ""}${long ? ` (${long})` : ""}. It's in your Schedule.`,
      };
    }
    case "full_day_one_off":
      return {
        title: `📅 Full Day Training booked for ${shortDay(b.date)}`,
        body: `${hi} ${b.dog} is in for Full Day Training on ${longDay(b.date)}. It's in your Schedule.`,
      };
    case "full_day": {
      const day = LONG_DAYS[parts(b.date).getUTCDay()];
      return {
        title: `📅 ${b.dog}'s Full Day Training: ${b.cadence === "alternating" ? "every other" : "every"} ${day}`,
        body: `${hi} ${b.dog} is in for Full Day Training ${b.cadence === "alternating" ? "every other" : "every"} ${day}, starting ${longDay(b.date)}. It's in your Schedule.`,
      };
    }
    case "meet_greet":
      return {
        title: `📅 Meet & greet booked for ${shortDay(b.date)}, ${clockTime(b.time)}`,
        body: `${hi} We're looking forward to meeting ${b.dog} on ${longDay(b.date)} at ${clockTime(b.time)}${b.address ? `, at ${b.address}` : ""}.`,
      };
  }
}
