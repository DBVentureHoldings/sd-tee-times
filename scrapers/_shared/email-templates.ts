/**
 * Email copy and markup for the subscriber emails. Pure functions: each
 * returns { subject, preheader, html, text } and never touches the network.
 *
 * Rules the renderers enforce (they throw rather than send a broken email):
 *  - no em-dash or en-dash anywhere (copy rule; course names come from
 *    lib/courses.ts, which has none)
 *  - no "undefined" / "NaN" leaking from a missing value
 *  - the unsubscribe link is present
 *
 * HTML is email-safe: tables, inline styles, no external CSS or images.
 * Colours match the site: cream #F5EFE0, Masters green #0E5B3D, red #C8102E.
 */
import { SITE_URL } from "../../lib/site.js";
import type { AreaBlock, EmailRow, SectionA } from "./email-select.js";

export interface RenderedEmail {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

const CREAM = "#F5EFE0";
const GREEN = "#0E5B3D";
const RED = "#C8102E";
const INK = "#171717";
const DISPLAY =
  "'Bebas Neue',Impact,'Arial Narrow Bold','Arial Narrow',Arial,sans-serif";
const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function unsubscribePageUrl(token: string): string {
  return `${SITE_URL}/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function oneClickUnsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/unsubscribe?t=${encodeURIComponent(token)}`;
}

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "A", "A and B", "A, B and C". */
function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function spotsText(n: number): string {
  return n === 1 ? "1 spot" : `${n} spots`;
}

// ---------------------------------------------------------------- pieces

function p(html: string, extra = ""): string {
  return `<p style="margin:0 0 14px 0;font-family:${SANS};font-size:16px;line-height:1.5;color:${INK};${extra}">${html}</p>`;
}

function h2(label: string): string {
  return `<h2 style="margin:22px 0 10px 0;font-family:${DISPLAY};font-weight:700;font-size:20px;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">${esc(label)}</h2>`;
}

function h3(label: string): string {
  return `<h3 style="margin:16px 0 6px 0;font-family:${DISPLAY};font-weight:700;font-size:16px;letter-spacing:1px;text-transform:uppercase;color:${INK};">${esc(label)}</h3>`;
}

function a(href: string, label: string, color = GREEN): string {
  return `<a href="${esc(href)}" style="color:${color};font-weight:700;text-decoration:underline;">${esc(label)}</a>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 18px 0;"><tr><td style="background:${RED};border:2px solid #000000;border-radius:2px;">
<a href="${esc(href)}" style="display:inline-block;padding:11px 20px;font-family:${DISPLAY};font-weight:700;font-size:18px;letter-spacing:1px;text-transform:uppercase;color:${CREAM};text-decoration:none;">${esc(label)}</a>
</td></tr></table>`;
}

function detailParts(r: EmailRow): string[] {
  const parts = [r.price ?? "price on course page", spotsText(r.spots)];
  if (r.showHoles) parts.push(`${r.holes} holes`);
  return parts;
}

function dealText(r: EmailRow): string | null {
  return r.deal
    ? `Deal: ${r.deal.percentOff}% under its usual ${r.deal.bucketWord} price (${r.deal.usual})`
    : null;
}

function rowHtml(r: EmailRow, withCourse = true): string {
  const head = withCourse
    ? `${esc(`${r.dayLabel} ${r.time}`)} &middot; ${a(r.url, r.courseName, INK)}`
    : `${a(r.url, `${r.dayLabel} ${r.dateLabel}, ${r.time}`, INK)}`;
  const deal = dealText(r);
  const details =
    esc(detailParts(r).join(" · ")) +
    (deal ? ` &middot; <span style="color:${RED};font-weight:700;">${esc(deal)}</span>` : "");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px 0;"><tr><td style="background:#FFFFFF;border:2px solid #000000;padding:10px 12px;">
<div style="font-family:${SANS};font-size:16px;font-weight:700;line-height:1.35;color:${INK};">${head}</div>
<div style="margin-top:3px;font-family:${SANS};font-size:14px;line-height:1.4;color:#444444;">${details}</div>
</td></tr></table>`;
}

function rowText(r: EmailRow, withCourse = true): string {
  const when = withCourse ? `${r.dayLabel} ${r.time}` : `${r.dayLabel} ${r.dateLabel}, ${r.time}`;
  const bits = [when];
  if (withCourse) bits.push(r.courseName);
  bits.push(...detailParts(r));
  const deal = dealText(r);
  if (deal) bits.push(deal);
  return `${bits.join("  ")}\n${r.url}`;
}

interface FooterOpts {
  token: string;
  donateUrl?: string;
  /** EMAIL_POSTAL_ADDRESS, owner's choice; rendered only when set. */
  postalAddress?: string;
}

function donateLineText(donateUrl: string): string {
  return `SD Tee Times is free and I pay for the servers myself. If it saves you a round of frustration, you can chip in for a coffee: ${donateUrl}`;
}

function footerHtml({ token, donateUrl, postalAddress }: FooterOpts): string {
  const small = `margin:0 0 10px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:#555555;`;
  const parts: string[] = [];
  if (donateUrl) {
    parts.push(
      `<p style="${small}">SD Tee Times is free and I pay for the servers myself. If it saves you a round of frustration, you can ${a(donateUrl, "chip in for a coffee", "#555555")}.</p>`,
    );
  }
  parts.push(
    `<p style="${small}">You're getting this because you signed up for tee time emails at ${a(SITE_URL, "sdteetimes.golf", "#555555")}. One email a week. ${a(unsubscribePageUrl(token), "Unsubscribe", "#555555")}</p>`,
  );
  if (postalAddress) parts.push(`<p style="${small}">SD Tee Times, ${esc(postalAddress)}</p>`);
  return parts.join("\n");
}

function footerText({ token, donateUrl, postalAddress }: FooterOpts): string {
  const lines: string[] = [];
  if (donateUrl) lines.push(donateLineText(donateUrl), "");
  lines.push(
    "You're getting this because you signed up for tee time emails at sdteetimes.golf. One email a week.",
    `Unsubscribe: ${unsubscribePageUrl(token)}`,
  );
  if (postalAddress) lines.push("", `SD Tee Times, ${postalAddress}`);
  return lines.join("\n");
}

function layout(inner: string, preheader: string, footer: string, isTest: boolean): string {
  const testBanner = isTest
    ? `<tr><td style="background:#FFF3B0;padding:8px 16px;font-family:${SANS};font-size:13px;color:${INK};border:2px solid #000000;border-bottom:0;">Test send. The unsubscribe link in this copy uses a fake token and removes nobody.</td></tr>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>SD Tee Times</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CREAM};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
<tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
${testBanner}
<tr><td style="background:${GREEN};border-top:4px solid ${RED};padding:14px 16px;">
<a href="${esc(SITE_URL)}" style="font-family:${DISPLAY};font-weight:700;font-size:24px;letter-spacing:1px;text-transform:uppercase;color:${CREAM};text-decoration:none;">SD Tee Times</a>
</td></tr>
<tr><td style="padding:20px 16px 8px 16px;">
${inner}
</td></tr>
<tr><td style="padding:12px 16px 20px 16px;border-top:1px solid #D9D0BA;">
${footer}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

const BAD = [/\u2014/, /\u2013/, /undefined/, /NaN/];

function check(e: RenderedEmail, token: string): RenderedEmail {
  const all = `${e.subject}\n${e.preheader}\n${e.html}\n${e.text}`;
  for (const re of BAD) {
    if (re.test(all)) throw new Error(`Email render guard: output contains ${re}`);
  }
  const unsub = unsubscribePageUrl(token);
  if (!e.html.includes(esc(unsub)) || !e.text.includes(unsub)) {
    throw new Error("Email render guard: unsubscribe link missing");
  }
  if (Buffer.byteLength(e.html, "utf8") > 100_000) {
    throw new Error("Email render guard: HTML over 100KB (Gmail clips at 102KB)");
  }
  return e;
}

// ---------------------------------------------------------------- intro

export interface IntroInput {
  token: string;
  /** Display names of the recipient's course picks, oldest first. */
  coursePicks: string[];
  courseCount: number;
  donateUrl?: string;
  postalAddress?: string;
  isTest?: boolean;
}

function picksSentence(picks: string[]): string | null {
  if (picks.length === 0) return null;
  if (picks.length === 1) return `${picks[0]} comes first.`;
  if (picks.length <= 3) return `Your courses come first: ${listJoin(picks)}.`;
  return `Your courses come first: ${picks[0]}, ${picks[1]} and ${picks.length - 2} more.`;
}

export function renderIntro(o: IntroInput): RenderedEmail {
  const subject = `${o.isTest ? "[TEST] " : ""}Hey, I'm Daniel. I built SD Tee Times.`;
  const preheader = "What you'll get from me, and how often.";
  const siteLink = `${SITE_URL}/?utm_source=email&utm_medium=email&utm_campaign=intro`;
  const picks = picksSentence(o.coursePicks);

  const paras = [
    "Hey, I'm Daniel.",
    "I built SD Tee Times because finding a tee time in San Diego sucks. Every course has its own booking site, and the good weekend times are gone before you've checked them all.",
    `So the site checks ${o.courseCount} golf courses in San Diego County and the Temecula Valley every 15 minutes and puts every open time on one page.`,
    `Here's what you'll get from me: one email a week, before the weekend, with the best open times.${picks ? ` ${picks}` : ""} That's it.`,
    "If something looks wrong, or there's a course you want added, just reply. It comes straight to me.",
  ];

  const inner = [
    ...paras.map((t) => p(esc(t))),
    button(siteLink, "See today's tee times"),
    p(`Talk soon,<br>Daniel`),
  ].join("\n");

  const html = layout(inner, preheader, footerHtml(o), !!o.isTest);
  const text = [
    ...(o.isTest ? ["TEST SEND. The unsubscribe link uses a fake token.", ""] : []),
    ...paras.flatMap((t) => [t, ""]),
    `See today's tee times: ${siteLink}`,
    "",
    "Talk soon,",
    "Daniel",
    "",
    "--",
    footerText(o),
    "",
  ].join("\n");

  return check({ subject, preheader, html, text }, o.token);
}

// ---------------------------------------------------------------- digest

export interface DigestInput {
  token: string;
  /** "Nov 27 to 29" */
  rangeLabel: string;
  fridayKey: string;
  sectionA: SectionA;
  sectionB: AreaBlock[];
  /** "Thursday 2:10 PM" */
  asOf: string;
  /** The recipient never got the intro: add a short hello. */
  firstEmail: boolean;
  donateUrl?: string;
  postalAddress?: string;
  isTest?: boolean;
}

export function digestRowCount(o: Pick<DigestInput, "sectionA" | "sectionB">): number {
  return o.sectionA.rowCount + o.sectionB.reduce((n, b) => n + b.rows.length, 0);
}

export function renderDigest(o: DigestInput): RenderedEmail {
  const prefix = o.isTest ? "[TEST] " : "";
  const hl = o.sectionA.headline;
  const subject = hl
    ? `${prefix}This weekend's tee times: ${hl.courseName} ${hl.dayLabel} ${hl.time} and more`
    : `${prefix}This weekend's tee times, ${o.rangeLabel}`;
  const count = digestRowCount(o);
  // Describe the selection, not the inventory: there are far more open times.
  const preheader = `${count} ${count === 1 ? "pick" : "picks"} for this weekend, as of ${o.asOf}.`;
  const allLink = `${SITE_URL}/this-weekend?utm_source=email&utm_medium=email&utm_campaign=digest-${o.fridayKey}`;

  const intro = `Open times for Friday to Sunday as of ${o.asOf}. They go fast, so check the course page before you plan around one.`;
  const hello =
    "First one? Hey, I'm Daniel. I built SD Tee Times because finding a tee time in San Diego sucks. This lands once a week, before the weekend. Reply anytime.";

  const html: string[] = [];
  const text: string[] = [];
  if (o.isTest) text.push("TEST SEND. The unsubscribe link uses a fake token.", "");

  html.push(
    `<h1 style="margin:0 0 10px 0;font-family:${DISPLAY};font-weight:700;font-size:28px;line-height:1.1;letter-spacing:1px;text-transform:uppercase;color:${GREEN};">This weekend's tee times</h1>`,
  );
  text.push("THIS WEEKEND'S TEE TIMES", "");
  if (o.firstEmail) {
    html.push(p(esc(hello), `background:#FFFFFF;border-left:4px solid ${RED};padding:10px 12px;`));
    text.push(hello, "");
  }
  html.push(p(esc(intro)));
  text.push(intro, "");

  // Your courses
  const A = o.sectionA;
  if (A.withRows.length + A.empty.length + A.more.length + A.unchecked.length > 0) {
    html.push(h2("Your courses"));
    text.push("YOUR COURSES");
    for (const c of A.withRows) {
      html.push(h3(c.courseName));
      text.push("", c.courseName.toUpperCase());
      for (const r of c.rows) {
        html.push(rowHtml(r, false));
        text.push(rowText(r, false));
      }
    }
    if (A.more.length > 0) {
      html.push(p(`More of your courses with open times: ${A.more.map((m) => a(m.url, m.courseName)).join(", ")}.`, "margin-top:10px;"));
      text.push("", `More of your courses with open times: ${A.more.map((m) => `${m.courseName} (${m.url})`).join(", ")}.`);
    }
    if (A.empty.length > 0) {
      const names = A.empty.map((m) => a(m.url, m.courseName));
      const namesText = A.empty.map((m) => m.courseName);
      const tail = "Cancellations do show up, so it's worth another look.";
      html.push(
        p(`Nothing open this weekend at ${listJoin(names)} as of ${esc(o.asOf)}. ${esc(tail)}`, "margin-top:10px;"),
      );
      text.push("", `Nothing open this weekend at ${listJoin(namesText)} as of ${o.asOf}. ${tail}`);
      for (const m of A.empty) text.push(m.url);
    }
    if (A.unchecked.length > 0) {
      const names = A.unchecked.map((m) => a(m.url, m.courseName));
      const namesText = A.unchecked.map((m) => m.courseName);
      const tail = "Check the course page for the latest.";
      html.push(
        p(`We couldn't check ${listJoin(names)} this week. ${esc(tail)}`, "margin-top:10px;"),
      );
      text.push("", `We couldn't check ${listJoin(namesText)} this week. ${tail}`);
      for (const m of A.unchecked) text.push(m.url);
    }
    text.push("");
  }

  // Best by area
  if (o.sectionB.length > 0) {
    const title =
      A.withRows.length + A.empty.length + A.more.length + A.unchecked.length > 0
        ? "More good weekend times"
        : "Best weekend times";
    html.push(h2(title));
    text.push("", title.toUpperCase());
    for (const b of o.sectionB) {
      html.push(h3(b.label));
      text.push("", b.label.toUpperCase());
      for (const r of b.rows) {
        html.push(rowHtml(r));
        text.push(rowText(r));
      }
    }
  }

  html.push(button(allLink, "See all weekend times"));
  text.push("", `See all weekend times: ${allLink}`, "");
  html.push(p(`Reply if a time or price looks off.<br>Daniel`));
  text.push("Reply if a time or price looks off.", "Daniel", "", "--", footerText(o), "");

  const rendered: RenderedEmail = {
    subject,
    preheader,
    html: layout(html.join("\n"), preheader, footerHtml(o), !!o.isTest),
    text: text.join("\n"),
  };
  return check(rendered, o.token);
}
