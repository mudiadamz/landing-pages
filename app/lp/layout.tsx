import type { Viewport } from "next";

// Edge-to-edge under the notch/home indicator, and let the reader own the whole
// screen. viewport-fit=cover only affects the /lp reader routes.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function LpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The page (.lp-page) is slightly taller than the visual viewport so iOS
  // Safari can shrink its address bar on scroll; the reader (.lp-reader) is
  // sticky + full dynamic-viewport height so it stays pinned and fills the space.
  return (
    <div className="lp-page w-full">
      <div className="lp-reader sticky top-0 w-full overflow-hidden">{children}</div>
    </div>
  );
}
