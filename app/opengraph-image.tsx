import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

/**
 * Open Graph share card — what shows when the site link is pasted into
 * iMessage, Reddit, Twitter/X, Slack, etc. Next auto-wires the <meta
 * og:image> tag from this file. Designed to look like the live product (a
 * mini tee sheet) rather than a static poster, so a share reads as "this is
 * a real, working tool."
 */
export const alt = "SD Tee Times — every open tee time across San Diego";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#0E5B3D";
const GREEN_DK = "#0A4530";
const CREAM = "#F5EFE0";
const RED = "#C8102E";
const INK = "#111111";

// Chunky outlined masthead effect. The app's <h1> uses a dark-green outline,
// but at share-card scale on a green field that reads flat — so here we use a
// black outline + hard offset, which pops AND ties into the black-bordered
// tee rows below (the app's dominant neo-brutalist motif).
const TITLE_SHADOW = [
  `-3px -3px 0 ${INK}`,
  `3px -3px 0 ${INK}`,
  `-3px 3px 0 ${INK}`,
  `3px 3px 0 ${INK}`,
  `7px 7px 0 rgba(0,0,0,0.3)`,
].join(", ");

// Illustrative tee-sheet rows — realistic San Diego finds that show the
// product at a glance (the rare weekend-morning "prime" slots + a deal).
const ROWS: Array<{
  time: string;
  ampm: string;
  course: string;
  price: string;
  tag?: { label: string; bg: string };
}> = [
  { time: "7:12", ampm: "AM", course: "Torrey Pines — South", price: "$258 · 4 spots", tag: { label: "PRIME", bg: GREEN } },
  { time: "8:03", ampm: "AM", course: "Maderas Golf Club", price: "$175 · 4 spots", tag: { label: "PRIME", bg: GREEN } },
  { time: "2:40", ampm: "PM", course: "Balboa Park GC", price: "$34 · 2 spots", tag: { label: "DEAL", bg: RED } },
];

const ACCENTS = ["#10b981", "#8b5cf6", "#f59e0b"];

export default async function OpengraphImage() {
  let fonts:
    | { name: string; data: Buffer; style: "normal"; weight: 400 }[]
    | undefined;
  try {
    const data = await readFile(new URL("./BebasNeue.ttf", import.meta.url));
    fonts = [{ name: "Bebas Neue", data, style: "normal", weight: 400 }];
  } catch {
    fonts = undefined;
  }
  const display = fonts ? "Bebas Neue" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: CREAM,
          padding: 32,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            border: `7px solid ${INK}`,
            background: CREAM,
          }}
        >
          {/* Masthead */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: GREEN,
              borderBottom: `5px solid ${INK}`,
              padding: "26px 44px 22px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  fontFamily: display,
                  fontSize: 92,
                  lineHeight: 1,
                }}
              >
                <span style={{ color: CREAM, textShadow: TITLE_SHADOW }}>SD</span>
                <span style={{ color: RED, textShadow: TITLE_SHADOW }}>TEE</span>
                <span style={{ color: CREAM, textShadow: TITLE_SHADOW }}>TIMES</span>
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 8,
                  fontFamily: display,
                  fontSize: 24,
                  letterSpacing: 7,
                  color: "rgba(245,239,224,0.72)",
                }}
              >
                SAN DIEGO&apos;S OPEN TEE SHEET
              </div>
            </div>
            <div
              style={{
                display: "flex",
                border: "2px solid rgba(245,239,224,0.55)",
                padding: "6px 13px",
                fontFamily: display,
                fontSize: 22,
                letterSpacing: 4,
                color: CREAM,
              }}
            >
              VOL. I
            </div>
          </div>

          {/* Body: mini tee sheet — shows the live product at a glance */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              padding: "26px 44px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {ROWS.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 78,
                    background: "#ffffff",
                    border: `3px solid ${INK}`,
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 12,
                      height: 78,
                      background: ACCENTS[i],
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      width: 168,
                      paddingLeft: 22,
                      fontFamily: display,
                      color: INK,
                    }}
                  >
                    <span style={{ fontSize: 46 }}>{r.time}</span>
                    <span style={{ fontSize: 24, marginLeft: 6 }}>{r.ampm}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        fontFamily: display,
                        fontSize: 34,
                        letterSpacing: 0.5,
                        color: INK,
                      }}
                    >
                      {r.course.toUpperCase()}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        fontSize: 22,
                        color: "#555555",
                      }}
                    >
                      {r.price}
                    </div>
                  </div>
                  {r.tag ? (
                    <div
                      style={{
                        display: "flex",
                        marginRight: 20,
                        background: r.tag.bg,
                        color: CREAM,
                        fontFamily: display,
                        fontSize: 24,
                        letterSpacing: 2,
                        padding: "6px 16px",
                        borderRadius: 3,
                        border: `2px solid ${INK}`,
                      }}
                    >
                      {r.tag.label}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/* Footer band */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: GREEN,
              borderTop: `5px solid ${INK}`,
              padding: "18px 44px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: display,
                fontSize: 25,
                letterSpacing: 2,
                color: "rgba(245,239,224,0.9)",
              }}
            >
              35+ COURSES · FREE · NO LOGIN · LIVE EVERY 30 MIN
            </div>
            <div
              style={{
                display: "flex",
                fontFamily: display,
                fontSize: 30,
                letterSpacing: 2,
                color: CREAM,
              }}
            >
              SDTEETIMES.GOLF
            </div>
          </div>
        </div>
      </div>
    ),
    fonts ? { ...size, fonts } : { ...size },
  );
}
