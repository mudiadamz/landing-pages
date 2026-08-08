import type { Viewport } from "next";

// Edge-to-edge under the notch/home indicator. viewport-fit=cover only affects
// the /lp reader routes.
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
  // .lp-page scrolls the window (min-height a touch over the visual viewport) so
  // iOS Safari can shrink its address bar. The inline EPUB reader flows here and
  // scrolls the window natively; other preview types add their own fixed surface.
  return <div className="lp-page w-full">{children}</div>;
}
