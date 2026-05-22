import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";

/**
 * Open Graph share card — what shows when the site link is pasted into
 * iMessage, Twitter/X, Slack, etc. Next auto-wires the <meta og:image>
 * tag from this file. Mirrors the app's masthead: green panel, magazine
 * lettering, cream body.
 */
export const alt = "SD Tee Times — every open tee time across San Diego";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  // Load the app's display font so the card matches the brand. If the font
  // can't be read for any reason, fall back to ImageResponse's default —
  // a slightly off-brand card still beats a broken/blank one.
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
          background: "#F5EFE0",
          padding: 40,
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            flex: 1,
            border: "7px solid #111111",
          }}
        >
          {/* Green masthead */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: "#0E5B3D",
              padding: "46px 56px 40px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 40,
                fontFamily: display,
                fontSize: 150,
                lineHeight: 1,
              }}
            >
              <span style={{ color: "#F5EFE0" }}>SD</span>
              <span style={{ color: "#C8102E" }}>TEE</span>
              <span style={{ color: "#F5EFE0" }}>TIMES</span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 14,
                fontFamily: display,
                fontSize: 33,
                letterSpacing: 8,
                color: "rgba(245,239,224,0.72)",
              }}
            >
              SAN DIEGO&apos;S OPEN TEE SHEET
            </div>
          </div>

          {/* Cream body */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              justifyContent: "center",
              padding: "0 56px",
            }}
          >
            <div
              style={{
                display: "flex",
                fontFamily: display,
                fontSize: 82,
                lineHeight: 1,
                color: "#0E5B3D",
              }}
            >
              EVERY OPEN TEE TIME, ONE PLACE
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 31,
                color: "#3a3a3a",
              }}
            >
              25 San Diego courses · free · no login · updated every 30 min
            </div>
          </div>

          {/* Vol. I badge */}
          <div
            style={{
              position: "absolute",
              top: 30,
              right: 30,
              display: "flex",
              border: "2px solid rgba(245,239,224,0.55)",
              padding: "6px 13px",
              fontFamily: display,
              fontSize: 23,
              letterSpacing: 4,
              color: "#F5EFE0",
            }}
          >
            VOL. I
          </div>
        </div>
      </div>
    ),
    fonts ? { ...size, fonts } : { ...size },
  );
}
