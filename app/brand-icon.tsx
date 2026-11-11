import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The site icon, drawn once and used at two sizes by app/icon.tsx (browser
 * tab, search results) and app/apple-icon.tsx (iOS home screen). Same palette
 * and typeface as the header and the share card (app/opengraph-image.tsx):
 * dark-green field, cream "SD" in Bebas Neue, the red accent as a bar.
 *
 * Generated at build time; nothing here reads a request, so both routes are
 * static files.
 */
const GREEN_DK = "#0A4530";
const CREAM = "#F5EFE0";
const RED = "#C8102E";

export async function renderBrandIcon(px: number): Promise<ImageResponse> {
  let fonts:
    | { name: string; data: Buffer; style: "normal"; weight: 400 }[]
    | undefined;
  try {
    // Read from the project root. These routes are prerendered at build time,
    // when the working directory is the repo. (The `new URL(..., import.meta
    // .url)` form used in opengraph-image.tsx resolves to "/_next/static/…"
    // after bundling, which is not a file path, so that read fails and the
    // share card falls back to a system font.)
    const data = await readFile(join(process.cwd(), "app", "BebasNeue.ttf"));
    fonts = [{ name: "Bebas Neue", data, style: "normal", weight: 400 }];
  } catch {
    // Still a legible icon, just in the fallback typeface.
    fonts = undefined;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: GREEN_DK,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: fonts ? "Bebas Neue" : "sans-serif",
            fontSize: Math.round(px * 0.88),
            lineHeight: 1,
            letterSpacing: Math.round(px * 0.02),
            color: CREAM,
            // Bebas Neue sits high in its line box; nudge it to optical centre.
            marginTop: Math.round(px * 0.04),
          }}
        >
          SD
        </div>
        <div
          style={{
            display: "flex",
            width: Math.round(px * 0.62),
            height: Math.max(3, Math.round(px * 0.08)),
            marginTop: -Math.round(px * 0.07),
            background: RED,
          }}
        />
      </div>
    ),
    { width: px, height: px, fonts },
  );
}
