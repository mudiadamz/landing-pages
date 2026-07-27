import type { Viewport } from "next";

// Mirrors the /lp reader layout so an owned book reads exactly like the
// preview: edge-to-edge under the notch, and a window-scrolled page so iOS
// Safari can shrink its address bar as you read.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function ReadLayout({ children }: { children: React.ReactNode }) {
  return <div className="lp-page w-full">{children}</div>;
}
