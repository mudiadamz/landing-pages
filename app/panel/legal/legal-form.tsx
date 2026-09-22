"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateLegalContent } from "@/lib/actions/site-settings";
import { RichEditor, type RichEditorHandle } from "../pages/rich-editor";
import { LEGAL_KEYS, LEGAL_ROUTES, type LegalContent, type LegalKey } from "@/lib/legal-config";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

const TAB_LABEL: Record<LegalKey, MessageKey> = {
  privacy: "nav.privacyPolicy",
  terms: "nav.termsOfService",
  refund: "nav.refund",
};

/**
 * The three legal pages, one tab each.
 *
 * Tabs rather than three panel screens: they are edited together — a change to
 * the refund window belongs in the terms as well — and three sidebar entries for
 * three documents nobody opens weekly is three entries too many.
 *
 * Each editor is UNCONTROLLED (see RichEditor), so switching tabs cannot re-mount
 * one without losing what is in it. The bodies are therefore read out of every
 * editor on save, not on change, and all three tabs are mounted at once with the
 * inactive ones hidden.
 */
export function LegalForm({
  initial,
  siteId,
}: {
  initial: LegalContent;
  siteId: string;
}) {
  const t = useT();
  const [tab, setTab] = useState<LegalKey>("privacy");
  const [draft, setDraft] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // One handle per tab, so save can read all three whichever one is on screen.
  const editors: Record<LegalKey, React.RefObject<RichEditorHandle | null>> = {
    privacy: useRef<RichEditorHandle | null>(null),
    terms: useRef<RichEditorHandle | null>(null),
    refund: useRef<RichEditorHandle | null>(null),
  };

  function setField(key: LegalKey, field: "title" | "description", value: string) {
    setDraft((d) => ({ ...d, [key]: { ...d[key], [field]: value } }));
    setMsg(null);
  }

  function save() {
    setMsg(null);
    const next: LegalContent = { ...draft };
    for (const key of LEGAL_KEYS) {
      const html = editors[key].current?.getHtml();
      if (html !== undefined) next[key] = { ...next[key], body: html };
    }
    start(async () => {
      const res = await updateLegalContent(next, siteId);
      setMsg(
        res.ok
          ? { ok: true, text: t("sites.savedPublicLater") }
          : { ok: false, text: res.error ?? t("common.failed") },
      );
      if (res.ok) setDraft(next);
    });
  }

  const input =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {LEGAL_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "border-[var(--primary)] text-[var(--primary)]"
                : "border-transparent text-[var(--muted)] hover:text-foreground"
            }`}
          >
            {t(TAB_LABEL[key])}
          </button>
        ))}
      </div>

      {LEGAL_KEYS.map((key) => (
        <div key={key} className={tab === key ? "space-y-4" : "hidden"}>
          <div className="space-y-1.5">
            <label htmlFor={`legal-${key}-title`} className="block text-sm font-medium text-foreground">
              {t("content.pageTitle")}
            </label>
            <input
              id={`legal-${key}-title`}
              value={draft[key].title}
              onChange={(e) => setField(key, "title", e.target.value)}
              className={input}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`legal-${key}-description`} className="block text-sm font-medium text-foreground">
              {t("legal.metaDescription")}
            </label>
            <textarea
              id={`legal-${key}-description`}
              rows={2}
              value={draft[key].description}
              onChange={(e) => setField(key, "description", e.target.value)}
              className={`${input} resize-y`}
            />
            <p className="text-xs text-[var(--muted)]">{t("legal.metaHint")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              {t("editor.pageBody")}
            </label>
            <RichEditor
              initialHtml={draft[key].body}
              editorRef={editors[key]}
              onDirty={() => setMsg(null)}
            />
          </div>

          <Link
            href={LEGAL_ROUTES[key]}
            target="_blank"
            className="inline-block text-sm text-[var(--primary)] hover:underline"
          >
            {t("legal.viewPage", { route: LEGAL_ROUTES[key] })}
          </Link>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
        <Button size="md" onClick={save} disabled={pending} loading={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {/* Saving writes all three, so say so — an admin who edited two tabs
            should not have to guess whether the hidden one went with it. */}
        <span className="text-xs text-[var(--muted)]">{t("legal.savesAll")}</span>
        {msg && (
          <span
            className={`text-sm ${msg.ok ? "text-[var(--primary)]" : "text-red-600 dark:text-red-400"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
