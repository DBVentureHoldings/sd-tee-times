import type { Scraper } from "./_types.js";
import { foreUpScraper } from "./foreUp.js";
import { chronogolfScraper } from "./chronogolf.js";
import { sandiegoCityScraper } from "./sandiegoCity.js";

export const SCRAPERS: Record<string, Scraper> = {
  [foreUpScraper.id]: foreUpScraper,
  [chronogolfScraper.id]: chronogolfScraper,
  [sandiegoCityScraper.id]: sandiegoCityScraper,
};
