"use client";

import { useState, useTransition } from "react";
import { applyAsPublisher } from "@/lib/actions/profiles";
import { LivePhotoCapture } from "@/components/live-photo-capture";
import type { PublisherStatus, Standing } from "@/lib/profile-utils";
import { useT } from "@/lib/i18n/client";

const EMPTY = {
  realName: "",
  displayName: "",
  address: "",
  bankName: "",
  bankHolder: "",
  bankAccount: "",
};

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-[0.6875rem] text-[var(--muted)]">{hint}</span>}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={120}
        className={`mt-1 ${inputClass}`}
      />
    </label>
  );
}

function AreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      {hint && <span className="mt-0.5 block text-[0.6875rem] text-[var(--muted)]">{hint}</span>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={400}
        className={`mt-1 resize-y ${inputClass}`}
      />
    </label>
  );
}

export function PublisherApplyForm({
  standing,
  status: initialStatus,
  rejectNote,
  termsHeading,
  terms,
}: {
  standing: Standing;
  status: PublisherStatus;
  /** Why the last application was turned down, if it was. */
  rejectNote?: string | null;
  /** Publisher terms, configured in /panel/content. */
  termsHeading: string;
  terms: string[];
}) {
  const t = useT();
  const [status, setStatus] = useState<PublisherStatus>(initialStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const [ktp, setKtp] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [fields, setFields] = useState(EMPTY);
  const [agreed, setAgreed] = useState(false);

  const set = (k: keyof typeof EMPTY) => (v: string) => setFields((p) => ({ ...p, [k]: v }));
  const filled =
    fields.realName.trim().length >= 3 &&
    fields.displayName.trim().length >= 3 &&
    fields.address.trim().length >= 10 &&
    fields.bankName.trim() !== "" &&
    fields.bankHolder.trim() !== "" &&
    fields.bankAccount.trim() !== "";
  const ready = !!ktp && !!selfie && filled && agreed;

  // Admins and existing publishers never see the apply CTA.
  if (standing.isPlatform || standing.businessRole !== null) {
    return (
      <p className="text-sm text-[var(--muted)]">
        {standing.isPlatform ? t("panel.adminCanSell") : t("panel.publisherCanSell")}
      </p>
    );
  }

  function apply() {
    setError(null);
    startTransition(async () => {
      const res = await applyAsPublisher(ktp ?? undefined, selfie ?? undefined, {
        ...fields,
        acceptedTerms: agreed,
      });
      if (res.ok) {
        setStatus("pending");
        setForm(false);
        // Don't keep ID photographs or bank details in memory once handed over.
        setKtp(null);
        setSelfie(null);
        setFields(EMPTY);
        setAgreed(false);
      } else {
        setError(res.error ?? t("panel.applyFailed"));
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-[var(--muted)]">
        {t("panel.applyIntro")}
      </p>

      {status === "pending" ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {t("panel.applyPending")}
        </p>
      ) : (
        <>
          {status === "rejected" && (
            <div className="mt-3 rounded-lg border border-red-300/60 bg-red-50 p-3 dark:border-red-800/50 dark:bg-red-900/15">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {t("panel.applyRejected")}
              </p>
              {rejectNote && (
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {t("panel.adminNote")} {rejectNote}
                </p>
              )}
              <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
                {t("panel.applyAgainHint")}
              </p>
            </div>
          )}

          {form ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-[var(--muted)]">
                {t("panel.kycIntroBefore")}{" "}
                <strong className="text-foreground">{t("panel.kycIntroBold")}</strong>{" "}
                {t("panel.kycIntroAfter")}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <LivePhotoCapture
                  label={t("panel.idPhoto")}
                  hint={t("panel.idPhotoHint")}
                  facing="environment"
                  value={ktp}
                  onChange={setKtp}
                />
                <LivePhotoCapture
                  label={t("panel.selfiePhoto")}
                  hint={t("panel.selfieHint")}
                  facing="user"
                  value={selfie}
                  onChange={setSelfie}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={t("panel.legalName")}
                  hint={t("panel.legalNameHint")}
                  value={fields.realName}
                  onChange={set("realName")}
                  placeholder={t("panel.legalNamePlaceholder")}
                />
                <Field
                  label={t("panel.shopName")}
                  hint={t("panel.shopNameHint")}
                  value={fields.displayName}
                  onChange={set("displayName")}
                  placeholder={t("panel.shopNamePlaceholder")}
                />
              </div>

              <AreaField
                label={t("panel.address")}
                hint={t("panel.addressHint")}
                value={fields.address}
                onChange={set("address")}
                placeholder={t("panel.addressPlaceholder")}
              />

              <div className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-xs font-medium text-foreground">{t("panel.payoutAccount")}</p>
                <p className="mt-0.5 text-[0.6875rem] text-[var(--muted)]">
                  {t("panel.payoutAccountHint")}
                </p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <Field label={t("panel.bankName")} value={fields.bankName} onChange={set("bankName")} placeholder={t("panel.bankNamePlaceholder")} />
                  <Field label={t("panel.accountHolder")} value={fields.bankHolder} onChange={set("bankHolder")} placeholder={t("panel.accountHolderPlaceholder")} />
                  <Field label={t("panel.accountNumber")} value={fields.bankAccount} onChange={set("bankAccount")} placeholder="1234567890" />
                </div>
              </div>

              {terms.length > 0 && (
                <div className="rounded-lg border border-[var(--border)]">
                  <p className="border-b border-[var(--border)] px-3 py-2 text-xs font-medium text-foreground">
                    {termsHeading}
                  </p>
                  <ul className="max-h-48 space-y-2 overflow-y-auto px-3 py-2 text-[0.6875rem] leading-relaxed text-[var(--muted)]">
                    {terms.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden>{i + 1}.</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <label className="flex items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]"
                />
                <span>
                  {t("panel.kycConfirm")}{" "}
                  <strong className="font-medium">{termsHeading.toLowerCase()}</strong>.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={pending || !ready}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? t("panel.sending") : t("panel.sendApplication")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setForm(false);
                    setKtp(null);
                    setSelfie(null);
                    setFields(EMPTY);
                    setAgreed(false);
                    setError(null);
                  }}
                  disabled={pending}
                  className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
                {!ready && (
                  <span className="text-xs text-[var(--muted)]">
                    {!ktp || !selfie
                      ? t("panel.needBothPhotos")
                      : !filled
                        ? t("panel.needFields")
                        : t("panel.needTerms")}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setForm(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {status === "rejected" ? t("panel.applyAgain") : t("panel.applyPublisher")}
            </button>
          )}

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
