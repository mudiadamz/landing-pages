import Link from "next/link";
import type { PublisherStatus, Role } from "@/lib/profile-utils";
import { translator } from "@/lib/i18n";
import { requestLocale } from "@/lib/i18n/request";

/**
 * Publisher status at a glance, on the profile page.
 *
 * The application itself moved to /panel/publisher; what belongs here is the
 * answer to "where do I stand, and what did I submit". So this shows the state
 * as a stepper, echoes back the details that were sent, and links onward —
 * rather than repeating a form nobody fills in twice.
 *
 * Everything rendered here is the viewer's own row (RLS allows no other), and
 * the legal name and payout account are shown in full deliberately: this is the
 * one screen where a seller can catch a typo that would misdirect their money.
 */

export type PublisherInfo = {
  displayName: string | null;
  realName: string | null;
  address: string | null;
  bankName: string | null;
  bankHolder: string | null;
  bankAccount: string | null;
  termsAcceptedAt: string | null;
  appliedAt: string | null;
  rejectNote: string | null;
};

// Keys, resolved per render — see the note on PUBLISHER_BADGE in ../page.tsx.
const STEPS = ["panel.stepApplied", "panel.stepReviewed", "panel.stepApproved"] as const;

function stepIndex(status: PublisherStatus, role: Role): number {
  if (role === "publisher" || role === "admin" || status === "approved") return 2;
  if (status === "pending") return 1;
  if (status === "rejected") return 1;
  return -1;
}

function fmt(d: string | null): string {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(d));
  } catch {
    return "—";
  }
}

export async function PublisherCard({
  role,
  status,
  info,
}: {
  role: Role;
  status: PublisherStatus;
  info: PublisherInfo;
}) {
  const t = translator(await requestLocale());
  const isPublisher = role === "publisher" || role === "admin";
  const applied = status !== "none" || isPublisher;
  const active = stepIndex(status, role);
  const rejected = status === "rejected";

  const tone = isPublisher
    ? { chip: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", label: role === "admin" ? t("panel.roleAdmin") : t("panel.publisherActive") }
    : status === "pending"
      ? { chip: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", label: t("panel.publisherWaiting") }
      : rejected
        ? { chip: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", label: t("panel.rejected") }
        : { chip: "bg-[var(--background)] text-[var(--muted)]", label: t("panel.notApplied") };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone.chip}`}>
          {tone.label}
        </span>
        {info.appliedAt && (
          <span className="text-xs text-[var(--muted)]">
            {t("panel.appliedOn", { date: fmt(info.appliedAt) })}
          </span>
        )}
      </div>

      {/* Stepper — three states, so a bar communicates more than a sentence. */}
      {applied && (
        <ol className="flex items-center gap-1.5" aria-label={t("panel.applicationStatus")}>
          {STEPS.map((s, i) => {
            const done = i <= active;
            const failed = rejected && i === 1;
            return (
              <li key={s} className="flex flex-1 flex-col gap-1.5">
                <span
                  className={`h-1.5 rounded-full ${
                    failed
                      ? "bg-red-500"
                      : done
                        ? "bg-[var(--primary)]"
                        : "bg-[var(--border)]"
                  }`}
                />
                <span
                  className={`text-[11px] ${done || failed ? "text-foreground" : "text-[var(--muted)]"}`}
                >
                  {failed ? t("panel.rejected") : t(s)}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {rejected && info.rejectNote && (
        <p className="rounded-lg border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/15 dark:text-red-300">
          {t("panel.adminNote")} {info.rejectNote}
        </p>
      )}

      {applied ? (
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Item
            label={t("panel.shopName")}
            value={info.displayName}
            note={t("panel.shopNameNote")}
          />
          <Item
            label={t("panel.legalName")}
            value={info.realName}
            note={t("panel.legalNameNote")}
          />
          <Item
            label={t("panel.address")}
            value={info.address}
            note={t("panel.adminOnlyNote")}
            multiline
          />
          <Item
            label={t("panel.payoutAccount")}
            value={
              info.bankName || info.bankAccount
                ? `${info.bankName ?? "—"} · ${info.bankAccount ?? "—"}`
                : null
            }
            note={info.bankHolder ? `a.n. ${info.bankHolder}` : undefined}
          />
          <Item
            label={t("content.publisherTerms")}
            value={
              info.termsAcceptedAt
                ? t("panel.approvedOn", { date: fmt(info.termsAcceptedAt) })
                : null
            }
            note={info.termsAcceptedAt ? undefined : t("panel.legacyApplication")}
          />
        </dl>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          {t("panel.publisherPitch")}
        </p>
      )}

      <div>
        {isPublisher ? (
          <Link
            href="/panel/products"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t("panel.manageMyProducts")}
          </Link>
        ) : status === "pending" ? (
          <Link
            href="/panel/publisher"
            className="text-sm font-medium text-[var(--primary)] hover:underline"
          >
            {t("panel.viewApplication")}
          </Link>
        ) : (
          <Link
            href="/panel/publisher"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {rejected ? t("panel.applyAgain") : t("panel.applyPublisher")}
          </Link>
        )}
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  note,
  multiline,
}: {
  label: string;
  value: string | null;
  note?: string;
  /** Addresses are written across lines; truncating one to a single row hides
   *  the part that distinguishes it. */
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[var(--muted)]">{label}</dt>
      <dd
        className={`mt-0.5 text-sm font-medium text-foreground ${
          multiline ? "whitespace-pre-line break-words" : "truncate"
        }`}
        title={value ?? undefined}
      >
        {value || "—"}
      </dd>
      {note && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{note}</p>}
    </div>
  );
}
