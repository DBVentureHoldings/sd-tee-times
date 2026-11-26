import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Open Graph share card, "ticket" direction: one oversized tee-time ticket
 * (a single big time is the hero) tilted next to the stacked wordmark. Built
 * to read at ~300px wide in an iMessage link preview.
 */
export const alt =
  "SD Tee Times: every open tee time across San Diego. 47 courses, free, no login.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GREEN = "#0E5B3D";
const GREEN_DK = "#0A4530";
const CREAM = "#F5EFE0";
const RED = "#C8102E";
const INK = "#111111";

const outline = (w: number, drop: number) =>
  [
    `-${w}px -${w}px 0 ${INK}`,
    `${w}px -${w}px 0 ${INK}`,
    `-${w}px ${w}px 0 ${INK}`,
    `${w}px ${w}px 0 ${INK}`,
    `0 ${w}px 0 ${INK}`,
    `${w}px 0 0 ${INK}`,
    `0 -${w}px 0 ${INK}`,
    `-${w}px 0 0 ${INK}`,
    `${drop}px ${drop}px 0 ${INK}`,
  ].join(", ");

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

  const chip = (label: string, bg: string, color: string) => (
    <div
      style={{
        display: "flex",
        background: bg,
        color,
        border: `4px solid ${INK}`,
        boxShadow: `5px 5px 0 ${INK}`,
        alignItems: "center",
        flexShrink: 0,
        whiteSpace: "nowrap",
        height: 62,
        padding: "4px 14px 0",
        fontSize: 40,
        letterSpacing: 2,
        lineHeight: 1,
      }}
    >
      {label}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          fontFamily: display,
          background: GREEN,
          backgroundImage: `repeating-linear-gradient(90deg, ${GREEN} 0px, ${GREEN} 60px, ${GREEN_DK} 60px, ${GREEN_DK} 120px)`,
        }}
      >
        {/* Left: wordmark + facts */}
        <div
          style={{
            position: "absolute",
            left: 56,
            top: 44,
            width: 530,
            height: 542,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                gap: 26,
                fontSize: 190,
                lineHeight: 0.92,
              }}
            >
              <span style={{ color: CREAM, textShadow: outline(4, 9) }}>SD</span>
              <span style={{ color: RED, textShadow: outline(4, 9) }}>TEE</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 190,
                lineHeight: 0.92,
                color: CREAM,
                textShadow: outline(4, 9),
              }}
            >
              TIMES
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                fontSize: 37,
                letterSpacing: 2,
                color: "#F2C230",
                whiteSpace: "nowrap",
              }}
            >
              EVERY OPEN TEE TIME IN SAN DIEGO
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              {chip("47 COURSES", CREAM, INK)}
              {chip("FREE", RED, CREAM)}
              {chip("NO LOGIN", CREAM, INK)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 50,
                letterSpacing: 3,
                color: CREAM,
              }}
            >
              SDTEETIMES.GOLF
            </div>
          </div>
        </div>

        {/* Right: the ticket */}
        <div
          style={{
            position: "absolute",
            left: 580,
            top: 106,
            width: 540,
            height: 452,
            display: "flex",
            transform: "rotate(-5deg)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 540,
              height: 452,
              display: "flex",
              flexDirection: "column",
              background: CREAM,
              border: `8px solid ${INK}`,
              borderRadius: 14,
              boxShadow: `18px 18px 0 ${INK}`,
              overflow: "hidden",
            }}
          >
            {/* header strip */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: INK,
                color: CREAM,
                padding: "10px 26px 6px",
                fontSize: 34,
                letterSpacing: 4,
              }}
            >
              <span>OPEN TEE TIME</span>
            </div>

            {/* big time */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                padding: "14px 30px 0",
                color: INK,
              }}
            >
              <span style={{ fontSize: 250, lineHeight: 0.9 }}>7:12</span>
              <span style={{ fontSize: 96, lineHeight: 1, marginLeft: 12, marginBottom: 14 }}>
                AM
              </span>
            </div>

            {/* perforation */}
            <div
              style={{
                display: "flex",
                height: 6,
                marginTop: 4,
                backgroundImage: `repeating-linear-gradient(90deg, ${INK} 0px, ${INK} 18px, ${CREAM} 18px, ${CREAM} 32px)`,
              }}
            />

            {/* stub */}
            <div
              style={{
                display: "flex",
                flex: 1,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 30px 0",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 68, lineHeight: 1, color: INK }}>BALBOA PARK</span>
                <span style={{ fontSize: 32, letterSpacing: 3, color: GREEN }}>
                  4 SPOTS OPEN
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  background: GREEN,
                  color: CREAM,
                  border: `5px solid ${INK}`,
                  padding: "6px 16px 0",
                  fontSize: 64,
                  lineHeight: 1.1,
                }}
              >
                $34
              </div>
            </div>
          </div>

          {/* PRIME stamp */}
          <div
            style={{
              position: "absolute",
              right: -30,
              top: -34,
              display: "flex",
              transform: "rotate(14deg)",
              background: RED,
              color: CREAM,
              border: `7px solid ${INK}`,
              boxShadow: `8px 8px 0 ${INK}`,
              padding: "6px 22px 0",
              fontSize: 78,
              letterSpacing: 4,
              lineHeight: 1.1,
            }}
          >
            PRIME
          </div>
        </div>
      </div>
    ),
    fonts ? { ...size, fonts } : { ...size },
  );
}
