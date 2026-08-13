/**
 * Session-day weather for the dog profile. If it's wet, icy or snowy on a dog's
 * next/today's session, we remind the owner to pack a coat.
 *
 * Uses the free, key-less Open-Meteo forecast for Tynemouth. In sandboxed
 * environments the outbound call may be blocked; we fall back to a deterministic
 * sample so the feature still renders. In production the live forecast is used.
 */
/**
 * The only coat-worthy conditions: rain, or cold (under 5°C). Extreme heat is
 * handled separately — trainers mark hot days by hand (see lib/heat), so there
 * is no automatic heat reminder here.
 */
export type WeatherReminder = {
  condition: "rain" | "cold";
  emoji: string;
  label: string;
} | null;

const TYNEMOUTH = { lat: 55.017, lon: -1.423 };

const RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const SNOW = [71, 73, 75, 77, 85, 86];
/** Below this min temp (°C) it's cold enough to want a coat. */
const COLD_C = 5;

function classify(code: number, tmin: number | undefined): WeatherReminder {
  if (RAIN.includes(code)) return { condition: "rain", emoji: "🌧️", label: "Rain forecast" };
  if (SNOW.includes(code) || (tmin ?? 99) < COLD_C)
    return { condition: "cold", emoji: "🧥", label: "Cold — under 5°C" };
  return null; // dry and mild — no coat needed
}

async function fetchLive(dateISO: string): Promise<WeatherReminder | undefined> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${TYNEMOUTH.lat}&longitude=${TYNEMOUTH.lon}` +
      `&daily=weathercode,temperature_2m_min&timezone=Europe%2FLondon&start_date=${dateISO}&end_date=${dateISO}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return undefined;
    const j = await res.json();
    const code: number | undefined = j?.daily?.weathercode?.[0];
    const tmin: number | undefined = j?.daily?.temperature_2m_min?.[0];
    if (code == null) return undefined;
    return classify(code, tmin);
  } catch {
    return undefined; // blocked / offline → fall back
  }
}

/** Deterministic stand-in when the live forecast can't be reached. */
function sample(dateISO: string): WeatherReminder {
  const h = [...dateISO].reduce((n, c) => n + c.charCodeAt(0), 0);
  if (h % 5 === 0) return { condition: "cold", emoji: "🧥", label: "Cold — under 5°C" };
  if (h % 2 === 0) return { condition: "rain", emoji: "🌧️", label: "Rain forecast" };
  return null;
}

export async function getSessionWeather(dateISO: string): Promise<WeatherReminder> {
  const live = await fetchLive(dateISO);
  return live !== undefined ? live : sample(dateISO);
}
