/**
 * Resident-only tee times (Torrey Pines): tagging, no price, the open row
 * winning the same-slot dedupe, the price cap, and the weekly email.
 *
 * Pure functions only: no network, no database. Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  finalizeSlots,
  openClassesNotAnswered,
  parseSlots,
  type ForeUpSlot,
} from "./foreUp.js";
import { dedupeTeeTimes } from "./_shared/dedupe.js";
import { buildDigestData, type DigestRow } from "./_shared/email-select.js";
import type { ScrapedTeeTime } from "./_types.js";

const URL = "https://example.com/booking";
const slot = (time: string, green_fee: number): ForeUpSlot => ({
  time,
  green_fee,
  available_spots: 4,
  allowed_group_sizes: ["1", "2", "3", "4"],
  booking_fee_required: true,
  booking_fee_price: 32,
  booking_fee_per_person: true,
});

test("a slot from a resident class is tagged and carries no price or fee", () => {
  const [open] = parseSlots([slot("2026-12-05 08:00", 215)], URL, 18);
  assert.equal(open.priceCents, 21500);
  assert.equal(open.residentOnly, undefined);

  const [res] = parseSlots([slot("2026-12-05 08:00", 134)], URL, 18, true);
  assert.equal(res.residentOnly, true);
  assert.equal(res.priceCents, undefined);
  // Nothing account-specific rides along: only the known row fields.
  assert.deepEqual(Object.keys(res).sort(), [
    "bookingUrl",
    "holes",
    "playersAvail",
    "playersMax",
    "playersMin",
    "priceCents",
    "residentOnly",
    "teeTimeAt",
  ]);
});

test("the open row wins the same slot in both class orders", () => {
  const open = parseSlots([slot("2026-12-05 08:00", 215)], URL, 18);
  const res = parseSlots([slot("2026-12-05 08:00", 134)], URL, 18, true);
  for (const batch of [
    [...open, ...res],
    [...res, ...open],
  ]) {
    for (const out of [dedupeTeeTimes(batch), finalizeSlots(batch, {})]) {
      assert.equal(out.length, 1);
      assert.equal(out[0].residentOnly, undefined);
      assert.equal(out[0].priceCents, 21500);
    }
    // The shared writer dedupe run on top cannot undo it.
    const twice = dedupeTeeTimes(finalizeSlots(batch, {}));
    assert.equal(twice.length, 1);
    assert.equal(twice[0].priceCents, 21500);
  }
});

test("dedupe keeps a resident-only slot that has no open copy, and other holes", () => {
  const rows: ScrapedTeeTime[] = [
    ...parseSlots([slot("2026-12-05 08:00", 215)], URL, 18),
    ...parseSlots([slot("2026-12-05 08:00", 80)], URL, 9, true),
    ...parseSlots([slot("2026-12-05 08:10", 134)], URL, 18, true),
    ...parseSlots([slot("2026-12-05 08:10", 140)], URL, 18, true),
  ];
  const out = dedupeTeeTimes(rows);
  assert.equal(out.length, 3);
  assert.equal(out.filter((r) => r.residentOnly).length, 2);
});

test("between two open copies the later one still wins", () => {
  const out = dedupeTeeTimes([
    ...parseSlots([slot("2026-12-05 08:00", 215)], URL, 18),
    ...parseSlots([slot("2026-12-05 08:00", 190)], URL, 18),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].priceCents, 19000);
});

test("the price cap drops a junk open rate but never a resident-only row", () => {
  const rows = [
    ...parseSlots([slot("2026-12-05 08:00", 999)], URL, 18),
    ...parseSlots([slot("2026-12-05 08:10", 999)], URL, 18, true),
    ...parseSlots([slot("2026-12-05 08:20", 215)], URL, 18),
  ];
  const out = finalizeSlots(rows, { maxPriceCents: 45000 });
  assert.equal(out.length, 2);
  assert.equal(out[0].residentOnly, true);
  assert.equal(out[0].priceCents, undefined);
  assert.equal(out[1].priceCents, 21500);
});

test("dropAfterSunset leaves out resident-only slots that start in the dark", () => {
  const rows = [
    ...parseSlots([slot("2026-12-05 12:00", 134)], URL, 18, true),
    ...parseSlots([slot("2026-12-05 18:30", 134)], URL, 18, true),
  ];
  const out = finalizeSlots(rows, { dropAfterSunset: true });
  assert.equal(out.length, 1);
});

test("the weekly email never picks a resident-only time", () => {
  // Wednesday 2 Dec 2026, 10:00 Pacific. The target weekend is 4 to 6 Dec.
  const now = new Date("2026-12-02T18:00:00Z");
  const scraped_at = new Date(now.getTime() - 60_000).toISOString();
  const row = (iso: string, slug: string, resident_only: boolean): DigestRow => ({
    tee_time_at: iso,
    players_avail: 4,
    players_min: 1,
    price_cents: resident_only ? null : 21500,
    booking_url: URL,
    holes: 18,
    resident_only,
    scraped_at,
    courses: { slug, name: slug },
  });
  const data = buildDigestData(
    [
      row("2026-12-05T16:00:00Z", "torrey-pines-south", false),
      row("2026-12-05T16:10:00Z", "torrey-pines-south", true),
      row("2026-12-05T16:20:00Z", "torrey-pines-north", true),
    ],
    now,
  );
  const south = data.bySlug.get("torrey-pines-south") ?? [];
  assert.equal(south.length, 1);
  assert.equal(south[0].row.resident_only, false);
  // North has only a resident-only time: nothing to email, but the course
  // still counts as freshly checked (not as a scraper that is behind).
  assert.equal(data.bySlug.get("torrey-pines-north"), undefined);
  assert.ok(data.freshSlugs.has("torrey-pines-north"));
  assert.ok(!data.staleSlugs.has("torrey-pines-north"));
});

test("resident rows are not written unless every open class answered", () => {
  const classes = ["3181", "3201", "1135"];
  const resident = new Set(["3201", "1135"]);
  // Today: the open class answers, the resident classes are refused.
  assert.deepEqual(
    openClassesNotAnswered(
      classes,
      resident,
      new Set(["3181"]),
      new Set(["3201", "1135"]),
    ),
    [],
  );
  // Everything answers.
  assert.deepEqual(
    openClassesNotAnswered(classes, resident, new Set(classes), new Set()),
    [],
  );
  // The open class is refused while the resident classes answer.
  assert.deepEqual(
    openClassesNotAnswered(
      classes,
      resident,
      new Set(["3201", "1135"]),
      new Set(["3181"]),
    ),
    ["3181"],
  );
  // The open class answered for some days, then was refused mid-run.
  assert.deepEqual(
    openClassesNotAnswered(
      classes,
      resident,
      new Set(classes),
      new Set(["3181"]),
    ),
    ["3181"],
  );
  // The open class never answered (every day a 404).
  assert.deepEqual(
    openClassesNotAnswered(
      classes,
      resident,
      new Set(["3201"]),
      new Set(),
    ),
    ["3181"],
  );
  // Numeric ids in the config match string ids.
  assert.deepEqual(
    openClassesNotAnswered([3181, 3201], new Set(["3201"]), new Set(), new Set()),
    ["3181"],
  );
  // A course with no resident classes is never held back by this check.
  assert.deepEqual(
    openClassesNotAnswered(["1", "2"], new Set(), new Set(), new Set(["1"])),
    [],
  );
});
