"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "admin" | "customer";
};

export function UsersTable() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleRole(user: UserRow) {
    const newRole = user.role === "admin" ? "customer" : "admin";
    setUpdating(user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: newRole }),
      });
      const data = await res.json();
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u))
        );
      } else {
        alert(data.error ?? "Gagal mengubah role");
      }
    } finally {
      setUpdating(null);
    }
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
        <p className="text-sm text-[var(--muted)]">Memuat data user…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email…"
            className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-lg bg-background text-foreground text-sm placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
          />
        </div>
        <span className="text-xs text-[var(--muted)]">
          {filtered.length} user
        </span>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">
                  {u.full_name || "—"}
                </p>
                <p className="text-sm text-[var(--muted)] truncate">{u.email || "—"}</p>
              </div>
              <RoleBadge role={u.role} />
            </div>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => toggleRole(u)}
                disabled={updating === u.id}
                className="text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              >
                {updating === u.id
                  ? "Mengubah…"
                  : u.role === "admin"
                    ? "Jadikan customer"
                    : "Jadikan admin"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--background)]/50">
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Nama</th>
                <th className="text-left px-4 py-3 font-medium text-[var(--muted)]">Email</th>
                <th className="text-center px-4 py-3 font-medium text-[var(--muted)]">Role</th>
                <th className="text-right px-4 py-3 font-medium text-[var(--muted)]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {u.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{u.email || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleRole(u)}
                      disabled={updating === u.id}
                      className="text-xs font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
                    >
                      {updating === u.id
                        ? "Mengubah…"
                        : u.role === "admin"
                          ? "Jadikan customer"
                          : "Jadikan admin"}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--muted)]">
                    Tidak ada user ditemukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: "admin" | "customer" }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
        role === "admin"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          : "bg-[var(--accent-subtle)] text-[var(--muted)]"
      }`}
    >
      {role}
    </span>
  );
}
