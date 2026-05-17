import type { Scraper } from "./_types.js";
import { foreUpScraper } from "./foreUp.js";
import { chronogolfScraper } from "./chronogolf.js";
import { cpsScraper } from "./cps.js";
import { teeItUpScraper } from "./teeitup.js";
import { sandiegoCityScraper } from "./sandiegoCity.js";

export const SCRAPERS: Record<string, Scraper> = {
  [foreUpScraper.id]: foreUpScraper,
  [chronogolfScraper.id]: chronogolfScraper,
  [cpsScraper.id]: cpsScraper,
  [teeItUpScraper.id]: teeItUpScraper,
  [sandiegoCityScraper.id]: sandiegoCityScraper,
};
