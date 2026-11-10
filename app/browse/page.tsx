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
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<HomeSearchParams>;
}) {
  const filters = parseHomeFilters(await searchParams);
  // Nothing valid left to filter on (a day outside the sheet, an unknown
  // course, ?view=all, junk values): that is the default view, which "/"
  // serves from cache. Bounce before touching the database.
  if (isDefaultFilters(filters)) redirect("/");
  return <HomeView filters={filters} />;
}
