import type { Scraper } from "./_types.js";
import { foreUpScraper } from "./foreUp.js";
import { sandiegoCityScraper } from "./sandiegoCity.js";

export const SCRAPERS: Record<string, Scraper> = {
  [foreUpScraper.id]: foreUpScraper,
  [sandiegoCityScraper.id]: sandiegoCityScraper,
};
