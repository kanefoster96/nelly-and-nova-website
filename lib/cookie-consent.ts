/**
 * One on/off switch for marketing + analytics cookies (e.g. a Meta Pixel or
 * analytics added later), shared by the banner and anything that tracks.
 * It's a real cookie rather than localStorage so server code can read it too.
 * Remembering the choice is strictly necessary, so this cookie itself needs
 * no consent. Same name and values as the Kanvas Academy site.
 *
 * Nothing on the site tracks yet. Anything added later must check this
 * cookie (server) or listen for CONSENT_GRANTED_EVENT (client) before it loads.
 */
export const CONSENT_COOKIE_NAME = "mc_consent";
export const CONSENT_GRANTED = "granted";
export const CONSENT_DENIED = "denied";
export const CONSENT_COOKIE_DAYS = 365;

/** Dispatched on `window` the moment a visitor accepts, so tracking can start without a reload. */
export const CONSENT_GRANTED_EVENT = "mc-consent-granted";
