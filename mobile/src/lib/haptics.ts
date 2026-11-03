import * as Haptics from "expo-haptics";

/*
 * The app's haptics, copied from the Kanvas app's lib/haptics.ts and kept
 * few and meaningful the way Apple's own apps are: a tick when you choose
 * something, a light tap when you press a button, a firmer tap when you
 * change tab, and a success or error buzz only for a real outcome (a post
 * shared, a message that wouldn't send). Nothing on scrolling, typing or
 * focusing a field. iPhone haptics play on silent mode; on Android they
 * follow the phone's own vibration setting. None of these throw.
 */

/**
 * Counts every haptic fired, so the shared Pressable can tell whether the
 * button's own handler already gave one (a tick, an error) and skip its
 * light tap — one tap, one feel, never two.
 */
let fired = 0;
export function hapticsFired(): number {
  return fired;
}

/** A tick for choosing between options: a filter, a checkbox, a like. */
export function hapticSelection(): void {
  fired++;
  Haptics.selectionAsync().catch(() => {});
}

/** Changing tab: a firmer tap than a selection tick, since a whole page changes under the thumb. */
export function hapticTab(): void {
  fired++;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** A light tap for pressing anything: the shared Pressable fires it on every press. */
export function hapticTap(): void {
  fired++;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Pull-to-refresh: felt the moment the pull passes the line and the refresh starts. */
export function hapticRefresh(): void {
  fired++;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Something real went through: a post shared, a comment sent, homework logged. Once, for the outcome. */
export function hapticSuccess(): void {
  fired++;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** Nothing failed, something's missing: an empty post. */
export function hapticWarning(): void {
  fired++;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** A long press opening a menu: a firmer tap, so the hold is felt the moment it counts. */
export function hapticLongPress(): void {
  fired++;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Something didn't go through and the screen is showing why. */
export function hapticError(): void {
  fired++;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}
