/**
 * What an owner is told when a trainer taps "On route" on the app's Today
 * tab (app/api/route/notify). The one place to change the wording. Styled
 * like every automated notice: one emoji at the start of the title, a
 * friendly message with none.
 */
export type RouteRun = "pickup" | "dropoff";

export function onRouteMessage(run: RouteRun, dog: string, ownerFirstName: string): { title: string; body: string } {
  const hi = ownerFirstName ? `Hi ${ownerFirstName}!` : "Hi!";
  if (run === "pickup") {
    return {
      title: `🚐 We're on our way to collect ${dog}`,
      body: `${hi} You're our next stop, so we'll be with you shortly. Please have ${dog} ready with their lead on.`,
    };
  }
  return {
    title: `🏡 ${dog} is on the way home`,
    body: `${hi} ${dog} is our next drop-off, so we'll be with you shortly.`,
  };
}

/**
 * What an owner is told when a trainer taps "Picked up" or "Dropped off"
 * on the stop (the stop reaching done; app/api/route/notify with
 * event "done"). Once per stop.
 */
export function stopDoneMessage(run: RouteRun, dog: string): { title: string; body: string } {
  if (run === "pickup") {
    return {
      title: `🐾 ${dog}'s with us`,
      body: `${dog} has been collected and is on the way to training. We'll send updates through the day.`,
    };
  }
  return {
    title: `🏡 ${dog}'s home`,
    body: `${dog} is back home. Their report card will follow soon.`,
  };
}

/** "Sarah" from "Sarah Jones"; "" when there's no name. */
export function firstName(full: string | null | undefined): string {
  return (full ?? "").trim().split(/\s+/)[0] ?? "";
}
