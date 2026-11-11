import { renderBrandIcon } from "./brand-icon";

// iOS home-screen icon. Next adds the <link rel="apple-touch-icon"> tag.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return renderBrandIcon(size.width);
}
