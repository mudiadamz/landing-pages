import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/profiles";
import { NewPageForm } from "./new-page-form";

const STEPS = [
  { n: 1, title: "Buat produk", desc: "Judul & URL" },
  { n: 2, title: "Lengkapi detail", desc: "Preview, harga & file" },
];

export default async function NewPagePage() {
  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/panel");

  const current = 1; // this page is always step 1; step 2 is the edit page

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/panel"
          className="text-sm text-[var(--muted)] transition-colors hover:text-foreground"
        >
          ← Kembali
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">Produk digital baru</h1>
      </div>

      {/* Step indicator: step 1 (this page) → step 2 (the edit page) */}
      <ol className="flex items-center gap-3 sm:gap-4">
        {STEPS.map((step, i) => {
          const active = step.n === current;
          const done = step.n < current;
          return (
            <Fragment key={step.n}>
              <li className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : done
                        ? "bg-[var(--primary)]/15 text-[var(--primary)]"
                        : "border border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {step.n}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      active ? "text-foreground" : "text-[var(--muted)]"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{step.desc}</p>
                </div>
              </li>
              {i < STEPS.length - 1 && (
                <span className="h-px flex-1 bg-[var(--border)]" aria-hidden />
              )}
            </Fragment>
          );
        })}
      </ol>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-foreground">Info dasar</h2>
          <p className="text-sm text-[var(--muted)]">
            Langkah 1 dari 2 — mulai dari judul &amp; URL produk. Detail, harga, dan file diatur di
            langkah berikutnya.
          </p>
        </div>
        <NewPageForm />
      </div>
    </div>
  );
}
