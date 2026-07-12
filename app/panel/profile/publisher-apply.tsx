"use client";

import { useState, useTransition } from "react";
import { applyAsPublisher } from "@/lib/actions/profiles";
import type { PublisherStatus, Role } from "@/lib/profile-utils";

export function PublisherApply({
  role,
  status: initialStatus,
}: {
  role: Role;
  status: PublisherStatus;
}) {
  const [status, setStatus] = useState<PublisherStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Admins and existing publishers never see the apply CTA.
  if (role === "admin" || role === "publisher") {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 p-4">
        <p className="text-sm text-[var(--muted)]">
          {role === "admin"
            ? "Sebagai admin, Anda dapat mengelola & menjual produk."
            : "Anda adalah publisher — buka menu Produk digital untuk mulai menjual."}
        </p>
      </div>
    );
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyAsPublisher();
      if (res.ok) setStatus("pending");
      else setError(res.error ?? "Gagal mengirim pengajuan.");
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="text-sm font-semibold text-foreground">Jadi publisher</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Ingin menjual produk digital Anda sendiri di sini? Ajukan menjadi publisher.
        Setelah disetujui admin, Anda bisa membuat & menjual produk.
      </p>

      {status === "pending" ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Pengajuan sedang ditinjau admin
        </p>
      ) : (
        <>
          {status === "rejected" && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              Pengajuan sebelumnya ditolak. Anda dapat mengajukan lagi.
            </p>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={pending}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Mengirim…" : status === "rejected" ? "Ajukan lagi" : "Ajukan jadi publisher"}
          </button>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
