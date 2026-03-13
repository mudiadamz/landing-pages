import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/profile-utils";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const rawRole = row?.role;
  const normalizedRole = row ? normalizeRole(rawRole) : "customer";
  const profile = row
    ? {
        id: row.id,
        full_name: row.full_name ?? null,
        role: normalizedRole,
        email: user.email ?? null,
      }
    : {
        id: user.id,
        full_name: (user.user_metadata?.full_name as string) ?? null,
        role: "customer" as const,
        email: user.email ?? null,
      };

  console.info("[profile-page] debug", {
    user_id: user.id,
    user_email: user.email,
    profile_row: row ?? null,
    profile_error: profileError ? { message: profileError.message, code: profileError.code } : null,
    raw_role: rawRole,
    normalized_role: normalizedRole,
    final_role: profile.role,
  });

  const roleLabel = profile.role === "admin" ? "Admin" : "Customer";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] hover:text-foreground transition-colors"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Profil</h1>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-[var(--border)] bg-[var(--background)]/50">
          <h2 className="text-base font-semibold text-foreground">Detail akun</h2>
          <p className="text-sm text-[var(--muted)] mt-0.5">Informasi dan peran Anda di panel.</p>
        </div>
        <div className="p-4 sm:p-6 space-y-6">
          <dl className="grid gap-4 sm:grid-cols-1">
            <div>
              <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Email</dt>
              <dd className="text-sm text-foreground font-medium">
                {profile.email || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-[var(--muted)] uppercase tracking-wider mb-1">Peran (role)</dt>
              <dd>
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                    profile.role === "admin"
                      ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                      : "bg-[var(--accent-subtle)] text-[var(--muted)]"
                  }`}
                >
                  {roleLabel}
                </span>
              </dd>
            </div>
          </dl>

          <ProfileForm initialFullName={profile.full_name ?? ""} />
        </div>
      </div>
    </div>
  );
}
