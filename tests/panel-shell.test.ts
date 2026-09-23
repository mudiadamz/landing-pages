import { describe, expect, it } from "vitest";
import { isCustomerOnly, type PanelCapabilities } from "@/lib/panel-shell";

/**
 * Which shell a signed-in person gets at /panel.
 *
 * The two failures are not symmetrical, and that asymmetry is the whole design:
 * showing a buyer an admin console is embarrassing, while hiding the sidebar
 * from someone who can actually use it removes menus they had yesterday with
 * nothing on screen to explain it. So every capability — one is enough — keeps
 * the sidebar, and these tests are mostly about that direction.
 */
const caps = (o: Partial<PanelCapabilities> = {}): PanelCapabilities => ({
  isPlatform: false,
  businessRole: null,
  canSell: false,
  featureCount: 0,
  ...o,
});

describe("isCustomerOnly", () => {
  it("bukan siapa-siapa = shell akun", () => {
    expect(isCustomerOnly(caps())).toBe(true);
  });

  it.each([
    ["Platform", caps({ isPlatform: true })],
    ["owner business", caps({ businessRole: "owner" })],
    ["admin business", caps({ businessRole: "admin" })],
    // Staff tidak mengelola business, tapi dia menjual — dan layar jualan ada di
    // sidebar. Menaruhnya di shell akun berarti dia kehilangan alat kerjanya.
    ["staff business", caps({ businessRole: "staff" })],
    // Publisher & Agent situs masuk lewat canSell, bukan lewat peran business.
    ["publisher / agent situs", caps({ canSell: true })],
    // Satu fitur yang didelegasikan sudah cukup: layarnya ada di sidebar.
    ["satu fitur didelegasikan", caps({ featureCount: 1 })],
  ])("%s tetap dapat sidebar", (_label, c) => {
    expect(isCustomerOnly(c)).toBe(false);
  });

  it("tiap kemampuan berdiri sendiri — bukan gabungan yang harus lengkap", () => {
    // Kalau syaratnya pernah ditulis sebagai AND, seorang staff tanpa fitur
    // apa pun akan jatuh ke shell akun dan kehilangan menu Produk.
    expect(isCustomerOnly(caps({ businessRole: "staff", canSell: false, featureCount: 0 }))).toBe(false);
  });
});
