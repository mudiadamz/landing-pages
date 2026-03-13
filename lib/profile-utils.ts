export function normalizeRole(value: unknown): "admin" | "customer" {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "admin" ? "admin" : "customer";
}
