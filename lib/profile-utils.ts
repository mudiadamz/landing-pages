export type Role = "admin" | "customer" | "publisher";

export type PublisherStatus = "none" | "pending" | "approved" | "rejected";

export function normalizeRole(value: unknown): Role {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "admin") return "admin";
  if (s === "publisher") return "publisher";
  return "customer";
}

export function normalizePublisherStatus(value: unknown): PublisherStatus {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return "none";
}

/** Admin and approved publishers may create & sell products. */
export function canSell(role: Role): boolean {
  return role === "admin" || role === "publisher";
}

/** Human label for a role (id UI). */
export function roleLabel(role: Role): string {
  if (role === "admin") return "Admin";
  if (role === "publisher") return "Publisher";
  return "Customer";
}
