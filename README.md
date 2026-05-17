# SD Tee Times

Mobile-friendly web app for a foursome to spot the earliest open tee times
across San Diego munis & publics within ~45–60 min of 92109.

- **Frontend:** Next.js 15 (App Router) on Vercel
- **DB:** Supabase Postgres
- **Scraping:** Playwright + plain `fetch`, run from GitHub Actions on a 30-min
  cron — writes to Supabase via the service-role key

The web app is read-only; bookings happen on each course's own site (the "Book"
button is just a deep link).

## Setup

### 1. Supabase

1. Create a free project at https://supabase.com.
2. Open the **SQL editor**, paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql),
   and run it.
3. Project Settings → API: copy the **Project URL**, **anon public** key, and
   **service_role** key.

### 2. Local env

```bash
cp .env.example .env
# Fill in SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.
```

### 3. Install

```bash
npm install
npx playwright install chromium
```

### 4. Configure courses

Open [`scrapers/courses.json`](scrapers/courses.json). Each entry has a
`scraperConfig` block with `"TODO"` placeholders.

- **ForeUp courses:** open the booking page, open browser dev tools → Network
  → XHR, filter for `booking/times`. Copy `schedule_id` and `booking_class`
  into the matching course's `scraperConfig`.
- **City of SD courses (sandiegoCity):** the EZLinks widget needs a deeper
  look — see the `TODO` in [`scrapers/sandiegoCity.ts`](scrapers/sandiegoCity.ts).
  Start with one course (Balboa is simplest) and work outward.

Mark `"active": true` once a course's config is filled in.

### 5. Run scrapers locally

```bash
npm run scrape
# or one course only:
npm run scrape:one -- --only=coronado-muni
```

Each run prints a per-course summary. Successful runs write rows into
`tee_times` and a row into `scrape_runs`.

### 6. Run the web app locally

```bash
npm run dev
# open http://localhost:3000
```

If you're on the same wifi as your phone, hit
`http://<your-mac-ip>:3000` from your phone to see the mobile layout.

### 7. Deploy

1. Push to a GitHub repo.
2. Connect the repo to Vercel. Set the env vars from `.env` in the Vercel
   project settings (the `NEXT_PUBLIC_*` ones).
3. In the GitHub repo, **Settings → Secrets and variables → Actions**, add
   secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   The cron workflow at
   [`.github/workflows/scrape.yml`](.github/workflows/scrape.yml) will start
   running automatically.

## Architecture

```
┌────────────────────┐    cron */30 min     ┌─────────────────────┐
│  GitHub Actions    │ ───────────────────▶ │  scrapers/_runner   │ ─▶ Supabase
│  scrape.yml        │                      │  (Playwright + JSON)│    tee_times
└────────────────────┘                      └─────────────────────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────┐
                                                              │  Next.js page  │ ─▶ phone
                                                              │  on Vercel     │
                                                              └────────────────┘
```

- `scrapers/_runner.ts` walks `courses.json`, dispatches each entry to its
  scraper, writes results to Supabase, records a `scrape_runs` row per course.
- `scrapers/foreUp.ts` is a pure `fetch` against ForeUp's public JSON endpoint
  (no headless browser needed).
- `scrapers/sandiegoCity.ts` uses Playwright against the City of SD's EZLinks
  widget (selectors are TODO).
- `app/page.tsx` is a server component that queries Supabase directly. Tee
  times with `players_avail >= 2` get a green "2+ open" badge; 1-spot
  openings render dimmed.

## Adding a new course

1. Add an entry to `scrapers/courses.json` with `scraperId` of an existing
   scraper, fill in `scraperConfig`, set `"active": true`.
2. Run `npm run scrape:one -- --only=<slug>` and verify a non-zero count.
3. Push. Cron will pick it up on the next tick.

If the course is on a platform you don't have a scraper for yet, write a new
file in `scrapers/<platform>.ts` that exports a `Scraper`, register it in
`scrapers/_registry.ts`, and point `scraperId` at it.

## Caveats

- Per-course scrapers are brittle — expect ~1 break/month. The
  `scrape_runs` table makes failures observable.
- Scraping booking pages is technically against most ToS. Personal use among
  4 friends is low real-world risk; don't share the app publicly and keep the
  cron polite (30 min is plenty).
- GH Actions free private tier is 2000 min/mo. At ~2 min per run × 48
  runs/day × 30 days = ~2880 min/mo. If you go over, make the repo public
  (free unlimited minutes) or move to a $5 VPS.
