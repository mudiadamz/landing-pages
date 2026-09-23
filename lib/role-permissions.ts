/* Role-based feature access. Framework-free so both client & server can import it.
 *
 * TWO matrices, on two different axes, deliberately not merged
 * (docs/plans/multi-business-saas.md, Fase 5):
 *
 *   per SITE      customer | publisher  → which admin features a storefront's
 *                 buyers get. Stored in lp_site_settings key "role_permissions".
 *                 A storefront question, answered per storefront.
 *
 *   per BUSINESS  admin | staff         → which admin features the people who
 *                 RUN a business get. Stored in lp_businesses.role_permissions.
 *                 Owner is not configurable: an owner who could be locked out of
 *                 their own business is a support ticket, not a feature.
 *
 * Merging them into one table was tempting and wrong: "publisher" is somebody's
 * customer, "staff" is somebody's employee, and a business that hires a second
 * person should not thereby change what its buyers can see.
 */

import { ALL_FEATURE_KEYS, normalizeFeatures, type FeatureKey } from "@/lib/features";

/** Roles whose feature access is configurable per SITE. */
export type ConfigurableRole = "customer" | "publisher";

export type RolePermissions = Record<ConfigurableRole, FeatureKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  customer: [],
  publisher: [],
};

export function normalizeRolePermissions(raw: unknown): RolePermissions {
  if (!raw || typeof raw !== "object") return DEFAULT_ROLE_PERMISSIONS;
  const v = raw as Record<string, unknown>;
  return {
    customer: normalizeFeatures(v.customer),
    publisher: normalizeFeatures(v.publisher),
  };
}

/** Roles whose feature access is configurable per BUSINESS. Owner always has everything. */
export type BusinessConfigurableRole = "admin" | "staff";

export type BusinessRolePermissions = Record<BusinessConfigurableRole, FeatureKey[]>;

/**
 * What a business that has never touched the screen gets.
 *
 * `admin` = everything, on purpose: an Agent under the old model had every
 * feature of the sites they managed, and every Agent became a business admin in
 * the Fase 5 backfill. A stricter default would have silently taken menus away
 * from people who had them the day before.
 *
 * `staff` = nothing: the role did not exist before, so there is nobody to
 * surprise, and "you were given nothing until someone decided" is the right way
 * round for a brand-new level of access.
 */
export const DEFAULT_BUSINESS_ROLE_PERMISSIONS: BusinessRolePermissions = {
  admin: [...ALL_FEATURE_KEYS],
  staff: [],
};

export function normalizeBusinessRolePermissions(raw: unknown): BusinessRolePermissions {
  if (!raw || typeof raw !== "object") return DEFAULT_BUSINESS_ROLE_PERMISSIONS;
  const v = raw as Record<string, unknown>;
  return {
    // A stored value wins even when empty — "the owner unticked everything" is a
    // decision, and falling back to the default there would silently undo it.
    admin: Array.isArray(v.admin) ? normalizeFeatures(v.admin) : DEFAULT_BUSINESS_ROLE_PERMISSIONS.admin,
    staff: Array.isArray(v.staff) ? normalizeFeatures(v.staff) : DEFAULT_BUSINESS_ROLE_PERMISSIONS.staff,
  };
}
