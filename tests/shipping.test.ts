import { describe, expect, it } from "vitest";
import {
  SHIPPING_REQUIRED,
  formatShipping,
  isPhoneLike,
  normalizeShipping,
  shippingColumns,
  shippingProblems,
  type ShippingAddress,
} from "@/lib/shipping";

const full: ShippingAddress = {
  name: "Siti",
  phone: "081234567890",
  address: "Jl. Mawar 12, RT 03/RW 04",
  city: "Bandung",
  province: "Jawa Barat",
  postalCode: "40123",
  note: "Titip satpam",
};

describe("normalizeShipping", () => {
  it("reads the form's field names and the database's, since both call this", () => {
    expect(normalizeShipping({ name: "Siti", phone: "0812", city: "Bandung" })?.name).toBe("Siti");
    expect(normalizeShipping({ shipping_name: "Siti", shipping_city: "Bandung" })?.name).toBe("Siti");
  });

  it("returns null when nothing was filled in — not an empty address", () => {
    expect(normalizeShipping({})).toBeNull();
    expect(normalizeShipping({ name: "   ", note: "" })).toBeNull();
    expect(normalizeShipping(null)).toBeNull();
    expect(normalizeShipping("Jl. Mawar")).toBeNull();
  });

  it("keeps a partially filled address so the buyer can be told what is missing", () => {
    const v = normalizeShipping({ name: "Siti" });
    expect(v).not.toBeNull();
    expect(shippingProblems(v)).toContain("city");
  });

  it("trims and caps every field", () => {
    const v = normalizeShipping({ name: "  Siti  ", postalCode: "4".repeat(40) })!;
    expect(v.name).toBe("Siti");
    expect(v.postalCode.length).toBe(12);
  });

  it("leaves the optional fields null rather than empty strings", () => {
    const v = normalizeShipping({ name: "Siti" })!;
    expect(v.province).toBeNull();
    expect(v.note).toBeNull();
  });
});

describe("isPhoneLike", () => {
  it("accepts the same number written the ways people write it", () => {
    for (const p of ["081234567890", "+62 812 3456 7890", "0812-3456-7890"]) {
      expect(isPhoneLike(p), p).toBe(true);
    }
  });

  it("rejects what is plainly not a phone number", () => {
    for (const p of ["", "ya", "40123", "0".repeat(20)]) {
      expect(isPhoneLike(p), p).toBe(false);
    }
  });
});

describe("shippingProblems", () => {
  it("passes a complete address", () => {
    expect(shippingProblems(full)).toEqual([]);
  });

  it("does not require province or note — plenty of addresses carry neither", () => {
    expect(shippingProblems({ ...full, province: null, note: null })).toEqual([]);
  });

  it("reports a missing field", () => {
    expect(shippingProblems({ ...full, city: "" })).toEqual(["city"]);
  });

  it("reports an unusable phone once, not twice", () => {
    expect(shippingProblems({ ...full, phone: "ya" })).toEqual(["phone"]);
  });

  it("treats no address at all as every required field missing", () => {
    expect(shippingProblems(null)).toEqual([...SHIPPING_REQUIRED]);
  });
});

describe("writing and showing", () => {
  it("maps to the column names both tables use", () => {
    expect(shippingColumns(full)).toEqual({
      shipping_name: "Siti",
      shipping_phone: "081234567890",
      shipping_address: "Jl. Mawar 12, RT 03/RW 04",
      shipping_city: "Bandung",
      shipping_province: "Jawa Barat",
      shipping_postal_code: "40123",
      shipping_note: "Titip satpam",
    });
  });

  it("formats one line, skipping the parts that are not there", () => {
    expect(formatShipping(full)).toBe("Jl. Mawar 12, RT 03/RW 04, Bandung, Jawa Barat, 40123");
    expect(formatShipping({ ...full, province: null })).toBe(
      "Jl. Mawar 12, RT 03/RW 04, Bandung, 40123",
    );
  });
});
