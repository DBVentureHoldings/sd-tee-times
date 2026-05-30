import type { Scraper } from "./_types.js";
import { foreUpScraper } from "./foreUp.js";
import { chronogolfScraper } from "./chronogolf.js";
import { cpsScraper } from "./cps.js";
import { teeItUpScraper } from "./teeitup.js";
import { golfNowScraper } from "./golfnow.js";
import { webTracScraper } from "./webtrac.js";
import { sandiegoCityScraper } from "./sandiegoCity.js";
import { clubCaddieScraper } from "./clubcaddie.js";
import { totaleIntegratedScraper } from "./totaleintegrated.js";

export const SCRAPERS: Record<string, Scraper> = {
  [foreUpScraper.id]: foreUpScraper,
  [chronogolfScraper.id]: chronogolfScraper,
  [cpsScraper.id]: cpsScraper,
  [teeItUpScraper.id]: teeItUpScraper,
  [golfNowScraper.id]: golfNowScraper,
  [webTracScraper.id]: webTracScraper,
  [sandiegoCityScraper.id]: sandiegoCityScraper,
  [clubCaddieScraper.id]: clubCaddieScraper,
  [totaleIntegratedScraper.id]: totaleIntegratedScraper,
};
