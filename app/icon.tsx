import { renderBrandIcon } from "./brand-icon";

// Browser-tab and search-result icon. 96px is a multiple of 48, which is
// what Google asks for. Next adds the <link rel="icon"> tag from this file.
export const size = { width: 96, height: 96 };
export const contentType = "image/png";

export default function Icon() {
  return renderBrandIcon(size.width);
}
