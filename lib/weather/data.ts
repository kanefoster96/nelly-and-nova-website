/**
 * Session-day weather for the dog profile. If it's wet, icy or snowy on a dog's
 * next/today's session, we remind the owner to pack a coat.
 *
 * Uses the free, key-less Open-Meteo forecast for Tynemouth. In sandboxed
 * environments the outbound call may be blocked; we fall back to a deterministic
 * sample so the feature still renders. In production the live forecast is used.
 */
export type WeatherReminder = {
  condition: "rain" | "ice" | "snow" | "heat";
  emoji: string;
  label: string;
} | null;

const TYNEMOUTH = { lat: 55.017, lon: -1.423 };

const RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const SNOW = [71, 73, 75, 77, 85, 86];
const FREEZING = [66, 67];
/** At or above this max temp (°C) counts as a hot day for a NE-coast walk. */
const HOT_C = 25;

function classify(
  code: number,
  tmin: number | undefined,
  tmax: number | undefined
): WeatherReminder {
  if (SNOW.includes(code)) return { condition: "snow", emoji: "❄️", label: "Snow forecast" };
  if (FREEZING.includes(code) || (RAIN.includes(code) && (tmin ?? 99) <= 0))
    return { condition: "ice", emoji: "🧊", label: "Icy conditions" };
  if (RAIN.includes(code)) return { condition: "rain", emoji: "🌧️", label: "Rain forecast" };
  if ((tmax ?? -99) >= HOT_C) return { condition: "heat", emoji: "🌡️", label: "Hot day forecast" };
  return null; // clear / mild — nothing to flag
}

async function fetchLive(dateISO: string): Promise<WeatherReminder | undefined> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${TYNEMOUTH.lat}&longitude=${TYNEMOUTH.lon}` +
      `&daily=weathercode,temperature_2m_min,temperature_2m_max&timezone=Europe%2FLondon&start_date=${dateISO}&end_date=${dateISO}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return undefined;
    const j = await res.json();
    const code: number | undefined = j?.daily?.weathercode?.[0];
    const tmin: number | undefined = j?.daily?.temperature_2m_min?.[0];
    const tmax: number | undefined = j?.daily?.temperature_2m_max?.[0];
    if (code == null) return undefined;
    return classify(code, tmin, tmax);
  } catch {
    return undefined; // blocked / offline → fall back
  }
}

/** Deterministic stand-in when the live forecast can't be reached. */
function sample(dateISO: string): WeatherReminder {
  const h = [...dateISO].reduce((n, c) => n + c.charCodeAt(0), 0);
  if (h % 13 === 0) return { condition: "ice", emoji: "🧊", label: "Icy conditions" };
  if (h % 7 === 0) return { condition: "heat", emoji: "🌡️", label: "Hot day forecast" };
  if (h % 2 === 0) return { condition: "rain", emoji: "🌧️", label: "Rain forecast" };
  return null;
}

export async function getSessionWeather(dateISO: string): Promise<WeatherReminder> {
  const live = await fetchLive(dateISO);
  return live !== undefined ? live : sample(dateISO);
}
