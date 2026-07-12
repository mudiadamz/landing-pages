/* Role-based feature access. Which admin features each non-admin role can reach,
 * configured from /panel/roles and stored as JSON in lp_site_settings under
 * "role_permissions". Admins always have everything (not stored here).
 * Framework-free so both client & server can import it. */

import { normalizeFeatures, type FeatureKey } from "@/lib/features";

/** Roles whose feature access is configurable (admin = all, customer/publisher tunable). */
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
