import Link from "next/link";

export const metadata = { title: "Page not found" };

// Same words as the framework's built-in 404, set on a paper sheet so the
// text does not sit on the bare cork background. Static, no data.
export default function NotFound() {
  return (
    <div className="sheet sheet-pad sheet-pinned space-y-3 text-center">
      <i className="pin pin-c" aria-hidden="true" />
      <h1 className="paper-h1">404</h1>
      <p className="paper-p mx-auto">This page could not be found.</p>
      <p className="pt-1">
        <Link href="/" prefetch={false} className="brand-btn">
          Full tee sheet
        </Link>
      </p>
    </div>
  );
}
