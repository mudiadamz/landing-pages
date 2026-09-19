import { describe, expect, it } from "vitest";
import { isFreeProduct } from "@/lib/product-status";

/**
 * "Free" decides who may claim a product without paying. The same rule lives in
 * the INSERT policy on lp_purchases; tests/db/rls-commerce.test.ts holds that
 * side. If these two ever disagree, a product is either unclaimable for free or
 * claimable for free while it is for sale.
 */
describe("isFreeProduct", () => {
  it("ditandai gratis = gratis, apa pun harganya", () => {
    expect(isFreeProduct({ is_free: true, price: 50_000 })).toBe(true);
    expect(isFreeProduct({ is_free: true, price: 50_000, price_discount: 10_000 })).toBe(true);
  });

  it("harga 0 atau kosong tanpa diskon = gratis", () => {
    expect(isFreeProduct({ price: 0 })).toBe(true);
    expect(isFreeProduct({ price: null })).toBe(true);
    expect(isFreeProduct({})).toBe(true);
  });

  it("berharga = berbayar", () => {
    expect(isFreeProduct({ price: 50_000 })).toBe(false);
    expect(isFreeProduct({ is_free: false, price: 1 })).toBe(false);
  });

  it("harga diskon positif ADALAH harganya — tidak gratis walau price 0", () => {
    expect(isFreeProduct({ price: 50_000, price_discount: 10_000 })).toBe(false);
    expect(isFreeProduct({ price: 0, price_discount: 10_000 })).toBe(false);
  });

  it("diskon 0 atau kosong tidak mengubah apa-apa", () => {
    expect(isFreeProduct({ price: 50_000, price_discount: 0 })).toBe(false);
    expect(isFreeProduct({ price: 0, price_discount: 0 })).toBe(true);
  });

  it("numeric dari Postgres datang sebagai string", () => {
    expect(isFreeProduct({ price: "50000.00" })).toBe(false);
    expect(isFreeProduct({ price: "0.00" })).toBe(true);
  });
});
