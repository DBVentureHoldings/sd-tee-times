import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Open Graph share card, "board" direction: a dark, full-bleed live
 * leaderboard. Built to read at ~300px wide in a chat link preview:
 * wordmark, a red LIVE badge, and three chunky tee-time rows.
 */
export const alt =
  "SD Tee Times: every open tee time across San Diego, live. 47 courses, free, no login.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN_DK = "#0A4530";
const GREEN_LT = "#1F7A53";
const CREAM = "#F5EFE0";
const RED = "#C8102E";
const INK = "#111111";

const OUTLINE = [
  `-3px -3px 0 ${INK}`,
  `3px -3px 0 ${INK}`,
  `-3px 3px 0 ${INK}`,
  `3px 3px 0 ${INK}`,
  `8px 8px 0 ${INK}`,
].join(", ");

// Illustrative rows only (not live data).
const ROWS = [
  { time: "6:52", ampm: "AM", course: "CORONADO", price: "$78" },
  { time: "8:03", ampm: "AM", course: "MADERAS", price: "$175" },
  { time: "2:40", ampm: "PM", course: "BALBOA PARK", price: "$34" },
];

const ROW_H = 106;

export default async function OpengraphImage() {
  let fonts:
    | { name: string; data: Buffer; style: "normal"; weight: 400 }[]
    | undefined;
  try {
    const data = await readFile(join(process.cwd(), "app", "BebasNeue.ttf"));
    fonts = [{ name: "Bebas Neue", data, style: "normal", weight: 400 }];
  } catch {
    fonts = undefined;
  }
  const display = fonts ? "Bebas Neue" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GREEN_DK,
          padding: "38px 48px 36px 40px",
          fontFamily: display,
        }}
      >
        {/* Mowing stripes + floodlight glow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background: `repeating-linear-gradient(115deg, rgba(31,122,83,0.0) 0px, rgba(31,122,83,0.0) 70px, rgba(31,122,83,0.22) 70px, rgba(31,122,83,0.22) 140px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background: `radial-gradient(circle at 20% 0%, rgba(31,122,83,0.75) 0%, rgba(10,69,48,0) 60%)`,
          }}
        />

        {/* Header: wordmark + LIVE */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 96,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 26,
              fontSize: 118,
              lineHeight: 1,
              letterSpacing: 2,
            }}
          >
            <span style={{ color: CREAM, textShadow: OUTLINE }}>SD</span>
            <span style={{ color: RED, textShadow: OUTLINE }}>TEE</span>
            <span style={{ color: CREAM, textShadow: OUTLINE }}>TIMES</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: RED,
              border: `5px solid ${INK}`,
              boxShadow: `8px 8px 0 ${INK}`,
              padding: "6px 24px 2px 20px",
              transform: "rotate(-3deg)",
            }}
          >
            <div
              style={{
                display: "flex",
                width: 30,
                height: 30,
                borderRadius: 15,
                background: "#ffffff",
                border: `4px solid ${INK}`,
                marginBottom: 6,
              }}
            />
            <span style={{ fontSize: 72, lineHeight: 1, color: "#ffffff", letterSpacing: 4 }}>
              LIVE
            </span>
          </div>
        </div>

        {/* Board */}
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          {ROWS.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "stretch",
                height: ROW_H,
                background: CREAM,
                border: `5px solid ${INK}`,
                boxShadow: `8px 8px 0 ${INK}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  width: 300,
                  background: INK,
                  color: CREAM,
                  paddingTop: 8,
                }}
              >
                <span style={{ fontSize: 96, lineHeight: 1 }}>{r.time}</span>
                <span style={{ fontSize: 46, lineHeight: 1, marginLeft: 10, color: "#F2C230" }}>
                  {r.ampm}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  paddingLeft: 30,
                  paddingTop: 8,
                  fontSize: 86,
                  lineHeight: 1,
                  letterSpacing: 1,
                  color: INK,
                }}
              >
                {r.course}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 220,
                  background: i === 2 ? RED : GREEN_LT,
                  borderLeft: `5px solid ${INK}`,
                  color: CREAM,
                  paddingTop: 8,
                  fontSize: 86,
                  lineHeight: 1,
                }}
              >
                {r.price}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 50,
            fontSize: 46,
            lineHeight: 1,
            letterSpacing: 3,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20, color: CREAM }}>
            <span>47 COURSES</span>
            <div style={{ display: "flex", width: 12, height: 12, background: RED }} />
            <span>FREE</span>
            <div style={{ display: "flex", width: 12, height: 12, background: RED }} />
            <span>NO LOGIN</span>
          </div>
          <span style={{ color: "#F2C230" }}>SDTEETIMES.GOLF</span>
        </div>
      </div>
    ),
    fonts ? { ...size, fonts } : { ...size },
  );
}
