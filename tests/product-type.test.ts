import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FULFILLMENT_STATUSES,
  PRODUCT_TYPES,
  SERVICE_MODES,
  deliversFile,
  initialFulfillment,
  isOpenOrder,
  nextFulfillmentStatuses,
  normalizeFulfillment,
  normalizeProductType,
  normalizeServiceMode,
  tracksStock,
} from "@/lib/product-type";

const MIGRATION = readFileSync("db/migrations/20260924000000_product_types.sql", "utf8");

/**
 * The two vocabularies live twice: as a TypeScript union here, and as a CHECK
 * constraint in the migration. Nothing connects them at compile time, so a
 * fourth product type added to one side and not the other type-checks, builds,
 * and fails at INSERT with a constraint violation nobody reads.
 *
 * These read the constraint out of the migration text rather than the database,
 * so they run in the fast suite with no container.
 */
function checkValues(constraint: string): string[] {
  const at = MIGRATION.indexOf(`add constraint ${constraint}`);
  if (at === -1) throw new Error(`constraint ${constraint} not found in the migration`);
  // The `in (…)` list of THIS constraint: the first one after its name, before
  // the next constraint in the same ALTER statement can introduce another.
  const list = MIGRATION.slice(at).match(/in \(([^)]*)\)/);
  if (!list) throw new Error(`constraint ${constraint} has no in (…) list`);
  return [...list[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
}

describe("product type vocabulary matches the database", () => {
  it("product_type", () => {
    expect(checkValues("lp_landing_pages_product_type_check")).toEqual([...PRODUCT_TYPES].sort());
  });

  it("service_mode", () => {
    expect(checkValues("lp_landing_pages_service_mode_check")).toEqual([...SERVICE_MODES].sort());
  });

  it("fulfillment_status", () => {
    expect(checkValues("lp_purchases_fulfillment_status_check")).toEqual(
      [...FULFILLMENT_STATUSES].sort(),
    );
  });
});

describe("normalize", () => {
  it("keeps a known product type", () => {
    expect(normalizeProductType("service")).toBe("service");
  });

  it("reads anything unknown as digital, because every legacy row is one", () => {
    expect(normalizeProductType(null)).toBe("digital");
    expect(normalizeProductType("hovercraft")).toBe("digital");
  });

  it("returns null for an unknown service mode rather than guessing one", () => {
    expect(normalizeServiceMode("remote")).toBe("remote");
    expect(normalizeServiceMode("")).toBeNull();
  });

  it("reads an unknown fulfillment status as pending, the side that gets noticed", () => {
    expect(normalizeFulfillment("shipped")).toBe("pending");
    expect(normalizeFulfillment("done")).toBe("done");
  });
});

describe("what a type implies", () => {
  it("only digital products hand over a file", () => {
    expect(deliversFile("digital")).toBe(true);
    expect(deliversFile("physical")).toBe(false);
    expect(deliversFile("service")).toBe(false);
  });

  it("only physical goods track stock", () => {
    expect(PRODUCT_TYPES.filter(tracksStock)).toEqual(["physical"]);
  });

  it("a digital purchase is delivered by the act of buying; nothing else is", () => {
    expect(initialFulfillment("digital")).toBe("done");
    expect(initialFulfillment("physical")).toBe("pending");
    expect(initialFulfillment("service")).toBe("pending");
  });
});

describe("fulfillment transitions", () => {
  it("lets a seller advance or cancel an open order", () => {
    expect(nextFulfillmentStatuses("pending")).toEqual(["processing", "done", "cancelled"]);
    expect(nextFulfillmentStatuses("processing")).toEqual(["done", "cancelled"]);
  });

  it("treats done and cancelled as terminal — a delivered order is not un-delivered", () => {
    expect(nextFulfillmentStatuses("done")).toEqual([]);
    expect(nextFulfillmentStatuses("cancelled")).toEqual([]);
  });

  it("counts exactly the unfinished statuses as open work", () => {
    expect(FULFILLMENT_STATUSES.filter(isOpenOrder)).toEqual(["pending", "processing"]);
  });
});
