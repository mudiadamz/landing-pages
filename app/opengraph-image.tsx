import { ImageResponse } from "next/og";

export const alt = "ADM.UIUX — Produk Digital Siap Pakai";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default site-wide OG image. Pages with a product thumbnail override this. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #0b1120 0%, #1e293b 100%)",
          color: "#f8fafc",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: 2, color: "#93c5fd" }}>
          ADM.UIUX
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 800, lineHeight: 1.1 }}>
            Produk digital siap pakai,
            <br />
            live hari ini.
          </div>
          <div style={{ display: "flex", fontSize: 32, color: "#cbd5e1" }}>
            Preview gratis · beli, download, pakai hari ini
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#94a3b8" }}>admuiux.com</div>
      </div>
    ),
    { ...size },
  );
}
