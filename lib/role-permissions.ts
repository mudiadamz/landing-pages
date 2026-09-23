/* Role-based feature access. Framework-free so both client & server can import it.
 *
 * TWO matrices, on two different axes, deliberately not merged:
 *
 *   per SITE      customer  → which admin features a storefront's BUYERS get.
 *                 Stored in lp_site_settings key "role_permissions". A
 *                 storefront question, answered per storefront.
 *
 *   per BUSINESS  staff     → which admin features a business's own people get.
 *                 Stored in lp_businesses.role_permissions. Owner is not
 *                 configurable: an owner who could be locked out of their own
 *                 business is a support ticket, not a feature.
 *
 * Merging them was tempting and wrong: "customer" is somebody's buyer, "staff"
 * is somebody's employee, and a business that hires a second person should not
 * thereby change what its buyers can see.
 *
 * Both lists lost a row when the roles were cut to four: "publisher" (a buyer
 * promoted to seller) and the business "admin" tier are gone. Stored JSON that
 * still carries them is simply ignored — normalize keeps only what is left.
 */

import { ALL_FEATURE_KEYS, normalizeFeatures, type FeatureKey } from "@/lib/features";

/** Roles whose feature access is configurable per SITE. */
export type ConfigurableRole = "customer";

export type RolePermissions = Record<ConfigurableRole, FeatureKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  customer: [],
};

export function normalizeRolePermissions(raw: unknown): RolePermissions {
  if (!raw || typeof raw !== "object") return DEFAULT_ROLE_PERMISSIONS;
  const v = raw as Record<string, unknown>;
  // A stored object from before the roles were cut may still carry a
  // "publisher" key; dropping it here is how it stops meaning anything.
  return { customer: normalizeFeatures(v.customer) };
}

/** Roles whose feature access is configurable per BUSINESS. Owner always has everything. */
export type BusinessConfigurableRole = "staff";

export type BusinessRolePermissions = Record<BusinessConfigurableRole, FeatureKey[]>;

/**
 * What a business that has never touched the screen gets: nothing.
 *
 * Staff is the only configurable tier, and "you were given nothing until someone
 * decided" is the right way round for delegated access — an owner adding their
 * first staff member should choose what that person can reach, not discover it.
 * Nobody loses anything by this default, because there were no staff accounts
 * when it was written.
 */
export const DEFAULT_BUSINESS_ROLE_PERMISSIONS: BusinessRolePermissions = {
  staff: [],
};

export function normalizeBusinessRolePermissions(raw: unknown): BusinessRolePermissions {
  if (!raw || typeof raw !== "object") return DEFAULT_BUSINESS_ROLE_PERMISSIONS;
  const v = raw as Record<string, unknown>;
  return {
    // A stored value wins even when empty — "the owner unticked everything" is a
    // decision, and falling back to the default there would silently undo it.
    staff: Array.isArray(v.staff) ? normalizeFeatures(v.staff) : DEFAULT_BUSINESS_ROLE_PERMISSIONS.staff,
  };
}
