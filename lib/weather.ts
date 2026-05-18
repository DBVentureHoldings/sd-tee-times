/**
 * Tiny weather helper for the day chips.
 *
 * Hits Open-Meteo's free forecast API (no key, no rate limit on the free
 * tier for low-volume use). One call returns daily forecasts for up to 16
 * days ahead, which we cache for 30 min. Beyond 16 days the chip just
 * shows no icon.
 *
 * Coordinates target central San Diego (Mission Bay / La Jolla area) —
 * all our scraped courses are within ~40 mi of this point, so a single
 * forecast is plenty for "is it going to rain at the golf course."
 */

import { unstable_cache } from "next/cache";

// Roughly Mission Bay — pulls forecasts that apply to Torrey, Balboa,
// Mission Bay, Coronado. North County (Encinitas/Carlsbad) and South
// County (Bonita/Chula Vista) are close enough for daily forecast use.
const SD_LAT = 32.85;
const SD_LON = -117.2;

/** Coarse weather state for icon mapping. Order matches visual severity. */
export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "rain"
  | "storm";

export interface DayWeather {
  kind: WeatherKind;
  /** High temp in °F, rounded. May be undefined if API omitted it. */
  highF?: number;
  /** Total precip for the day in inches. */
  precipIn?: number;
}

interface OpenMeteoResponse {
  daily?: {
    time: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    precipitation_sum?: number[];
  };
}

/**
 * Map WMO weather codes (used by Open-Meteo) to our coarse kinds.
 * See https://open-meteo.com/en/docs (weather_code section).
 */
function codeToKind(code: number | undefined): WeatherKind {
  if (code == null) return "cloudy";
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 95) return "storm";
  // 51-67 drizzle/rain, 71-77 snow (treat as rain for SD), 80-86 showers.
  return "rain";
}

/**
 * Internal: returns plain JSON-serializable entries (NOT a Map). This is
 * what `unstable_cache` wraps. Returning a Map directly causes Next to
 * serialize it to `{}` (losing the prototype) — at render time we'd then
 * call `.get()` on a plain object and crash with "f.get is not a function."
 */
async function fetchForecastEntries(): Promise<Array<[string, DayWeather]>> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${SD_LAT}&longitude=${SD_LON}` +
    `&daily=weather_code,temperature_2m_max,precipitation_sum` +
    `&temperature_unit=fahrenheit&precipitation_unit=inch` +
    `&timezone=America/Los_Angeles&forecast_days=16`;
  const out: Array<[string, DayWeather]> = [];
  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return out;
    const json = (await res.json()) as OpenMeteoResponse;
    const days = json.daily?.time ?? [];
    const codes = json.daily?.weather_code ?? [];
    const highs = json.daily?.temperature_2m_max ?? [];
    const precs = json.daily?.precipitation_sum ?? [];
    for (let i = 0; i < days.length; i++) {
      out.push([
        days[i],
        {
          kind: codeToKind(codes[i]),
          highF:
            typeof highs[i] === "number" ? Math.round(highs[i]) : undefined,
          precipIn: typeof precs[i] === "number" ? precs[i] : undefined,
        },
      ]);
    }
  } catch {
    // Network blip or API down: empty array. Day chips render fine without.
  }
  return out;
}

const cachedEntries = unstable_cache(
  fetchForecastEntries,
  ["sd-forecast-v2"],
  { revalidate: 1800, tags: ["weather"] },
);

/**
 * Cached 30 min. Returns a Map (rehydrated outside the cache layer so we
 * don't hit the serialization issue described above).
 */
export async function fetchSDForecast(): Promise<Map<string, DayWeather>> {
  const entries = await cachedEntries();
  return new Map(entries);
}
