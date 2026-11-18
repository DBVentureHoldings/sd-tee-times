import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  HomeView,
  isDefaultFilters,
  parseHomeFilters,
  type HomeSearchParams,
} from "../HomeView";

// The filtered tee sheet. Never linked or visited as /browse: next.config.ts
// rewrites "/?day|view|course|time=…" here, so the address bar keeps the
// homepage URL. Dynamic by nature (it reads searchParams).
// Same as the homepage's cap (app/page.tsx), stretching to at most double.
const BROWSE_ROW_CAP = 150;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams & { all?: string | string[] }>;
}) {
  const raw = await searchParams;
  const filters = parseHomeFilters(raw);
  const showAll = (Array.isArray(raw.all) ? raw.all[0] : raw.all) === "1";
  // Nothing valid left to filter on (a day outside the sheet, an unknown
  // course, ?view=all, junk values): that is the default view, which "/"
  // serves from cache. Bounce before touching the database.
  if (isDefaultFilters(filters)) redirect("/");
  // Every filtered view renders on each request, so it gets the homepage's
  // row cap (a full North County day is about 2 MB of HTML). The "Show all"
  // button adds all=1, which is the only way to get the uncapped day.
  return (
    <HomeView filters={filters} rowCap={showAll ? undefined : BROWSE_ROW_CAP} />
  );
}
