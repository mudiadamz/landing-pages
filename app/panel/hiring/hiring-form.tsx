"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { updateHiringContent } from "@/lib/actions/site-settings";
import { DEFAULT_HIRING, type HiringContent, type HiringQuestion } from "@/lib/hiring-config";
import { useT } from "@/lib/i18n/client";

const labelCls = "block text-xs font-medium text-[var(--muted)] mb-1.5";
const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]";
const sectionCls =
  "rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6 shadow-sm space-y-4";

function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium text-[var(--primary)] hover:underline"
    >
      + {children}
    </button>
  );
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="shrink-0 rounded-lg p-2 text-[var(--muted)] transition-colors hover:bg-[var(--background)] hover:text-red-600"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

/** A list of plain strings — qualifications, benefits, role tags. */
function StringList({
  items,
  onChange,
  addLabel,
  removeLabel,
  placeholder,
  itemLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  removeLabel: string;
  placeholder?: string;
  itemLabel?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={item}
            placeholder={placeholder}
            aria-label={itemLabel ? `${itemLabel} ${i + 1}` : undefined}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            className={inputCls}
          />
          <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} label={removeLabel} />
        </div>
      ))}
      <AddButton onClick={() => onChange([...items, ""])}>{addLabel}</AddButton>
    </div>
  );
}

/**
 * The job ad and the skill test behind it.
 *
 * The questions are the reason this is a structured form rather than the rich
 * text the legal pages get: each one carries a correct-answer index that the
 * grader in /api/hiring-test indexes into, and prose cannot express that.
 */
export function HiringForm({ initial, siteId }: { initial: HiringContent; siteId: string }) {
  const t = useT();
  const [draft, setDraft] = useState<HiringContent>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof HiringContent>(key: K, value: HiringContent[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMsg(null);
  }

  function setQuestion(index: number, patch: Partial<HiringQuestion>) {
    set(
      "questions",
      draft.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function addQuestion() {
    const nextId = draft.questions.reduce((max, q) => Math.max(max, q.id), 0) + 1;
    set("questions", [
      ...draft.questions,
      { id: nextId, question: "", options: ["", ""], answer: 0 },
    ]);
  }

  function save() {
    setMsg(null);
    start(async () => {
      const res = await updateHiringContent(draft, siteId);
      setMsg(
        res.ok
          ? { ok: true, text: t("sites.savedPublicLater") }
          : { ok: false, text: res.error ?? t("common.failed") },
      );
    });
  }

  return (
    <div className="space-y-5">
      <section className={sectionCls}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => set("enabled", e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">{t("hiring.enabled")}</span>
            <span className="mt-0.5 block text-xs text-[var(--muted)]">{t("hiring.enabledHint")}</span>
          </span>
        </label>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          {t("hiring.adHeading")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="hiring-badge">{t("hiring.badge")}</label>
            <input id="hiring-badge" value={draft.badge} onChange={(e) => set("badge", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls} htmlFor="hiring-title">{t("hiring.jobTitle")}</label>
            <input id="hiring-title" value={draft.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-intro">{t("hiring.intro")}</label>
          <textarea
            id="hiring-intro"
            rows={3}
            value={draft.intro}
            onChange={(e) => set("intro", e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </div>
        <div>
          <label className={labelCls}>{t("hiring.tags")}</label>
          <StringList
            items={draft.tags}
            onChange={(next) => set("tags", next)}
            addLabel={t("hiring.addTag")}
            removeLabel={t("common.delete")}
            itemLabel={t("hiring.tags")}
          />
        </div>
      </section>

      <section className={sectionCls}>
        <div>
          <label className={labelCls} htmlFor="hiring-scope-heading">{t("hiring.scopeHeading")}</label>
          <input
            id="hiring-scope-heading"
            value={draft.scopeHeading}
            onChange={(e) => set("scopeHeading", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-scope-body">{t("hiring.scopeBody")}</label>
          <textarea
            id="hiring-scope-body"
            rows={3}
            value={draft.scopeBody}
            onChange={(e) => set("scopeBody", e.target.value)}
            className={`${inputCls} resize-y`}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-requirements-heading">{t("hiring.requirementsHeading")}</label>
          <input
            id="hiring-requirements-heading"
            value={draft.requirementsHeading}
            onChange={(e) => set("requirementsHeading", e.target.value)}
            className={`${inputCls} mb-2`}
          />
          <StringList
            items={draft.requirements}
            onChange={(next) => set("requirements", next)}
            addLabel={t("hiring.addRequirement")}
            removeLabel={t("common.delete")}
            itemLabel={t("hiring.requirementsHeading")}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-benefits-heading">{t("hiring.benefitsHeading")}</label>
          <input
            id="hiring-benefits-heading"
            value={draft.benefitsHeading}
            onChange={(e) => set("benefitsHeading", e.target.value)}
            className={`${inputCls} mb-2`}
          />
          <StringList
            items={draft.benefits}
            onChange={(next) => set("benefits", next)}
            addLabel={t("hiring.addBenefit")}
            removeLabel={t("common.delete")}
            itemLabel={t("hiring.benefitsHeading")}
          />
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{t("hiring.ctaCard")}</h2>
        <div>
          <label className={labelCls} htmlFor="hiring-cta-heading">{t("panel.title")}</label>
          <input
            id="hiring-cta-heading"
            value={draft.ctaHeading}
            onChange={(e) => set("ctaHeading", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-cta-body">{t("panel.text")}</label>
          <textarea
            id="hiring-cta-body"
            rows={2}
            value={draft.ctaBody}
            onChange={(e) => set("ctaBody", e.target.value)}
            className={`${inputCls} resize-y`}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">{t("hiring.countHint")}</p>
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-cta-button">{t("product.ctaLabelField")}</label>
          <input
            id="hiring-cta-button"
            value={draft.ctaButton}
            onChange={(e) => set("ctaButton", e.target.value)}
            className={inputCls}
          />
        </div>
      </section>

      <section className={sectionCls}>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{t("hiring.testHeading")}</h2>
        <div>
          <label className={labelCls} htmlFor="hiring-test-title">{t("panel.title")}</label>
          <input
            id="hiring-test-title"
            value={draft.testTitle}
            onChange={(e) => set("testTitle", e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hiring-test-intro">{t("hiring.testIntro")}</label>
          <textarea
            id="hiring-test-intro"
            rows={3}
            value={draft.testIntro}
            onChange={(e) => set("testIntro", e.target.value)}
            className={`${inputCls} resize-y`}
          />
          <p className="mt-1 text-xs text-[var(--muted)]">{t("hiring.countHint")}</p>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            {t("hiring.questions", { count: draft.questions.length })}
          </h2>
          <AddButton onClick={addQuestion}>{t("hiring.addQuestion")}</AddButton>
        </div>
        <p className="text-xs text-[var(--muted)]">{t("hiring.questionsHint")}</p>

        {draft.questions.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--muted)]">
            {t("hiring.noQuestions")}
          </p>
        )}

        {draft.questions.map((q, qi) => (
          <div key={q.id} className="space-y-2 rounded-xl border border-[var(--border)] p-3">
            <div className="flex items-start gap-2">
              <span className="mt-2 shrink-0 text-xs tabular-nums text-[var(--muted)]">{qi + 1}.</span>
              <textarea
                rows={2}
                value={q.question}
                onChange={(e) => setQuestion(qi, { question: e.target.value })}
                placeholder={t("hiring.questionPlaceholder")}
                aria-label={`${t("hiring.questionPlaceholder")} ${qi + 1}`}
                className={`${inputCls} resize-y`}
              />
              <RemoveButton
                onClick={() => set("questions", draft.questions.filter((_, j) => j !== qi))}
                label={t("hiring.removeQuestion")}
              />
            </div>

            {/* The radio marks the correct answer, so the grader's index is set
                by picking it rather than typing a number. */}
            <div className="space-y-1.5 pl-6">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`answer-${q.id}`}
                    checked={q.answer === oi}
                    onChange={() => setQuestion(qi, { answer: oi })}
                    aria-label={t("hiring.markCorrect", { n: oi + 1 })}
                    className="h-4 w-4 shrink-0 accent-[var(--primary)]"
                  />
                  <input
                    value={opt}
                    onChange={(e) =>
                      setQuestion(qi, {
                        options: q.options.map((o, j) => (j === oi ? e.target.value : o)),
                      })
                    }
                    placeholder={t("hiring.optionPlaceholder")}
                    aria-label={`${t("hiring.optionPlaceholder")} ${oi + 1}`}
                    className={inputCls}
                  />
                  <RemoveButton
                    onClick={() => {
                      const options = q.options.filter((_, j) => j !== oi);
                      // Removing the correct option would otherwise leave the
                      // index pointing at whatever slid into its place.
                      const answer = q.answer === oi ? 0 : q.answer > oi ? q.answer - 1 : q.answer;
                      setQuestion(qi, { options, answer });
                    }}
                    label={t("hiring.removeOption")}
                  />
                </div>
              ))}
              <AddButton onClick={() => setQuestion(qi, { options: [...q.options, ""] })}>
                {t("hiring.addOption")}
              </AddButton>
            </div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="md" onClick={save} disabled={pending} loading={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        <button
          type="button"
          className="text-sm text-[var(--muted)] hover:text-foreground"
          onClick={() => {
            setDraft(DEFAULT_HIRING);
            setMsg(null);
          }}
        >
          {t("content.resetDefaults")}
        </button>
        <Link href="/hiring" target="_blank" className="ml-auto text-sm text-[var(--muted)] hover:text-foreground">
          {t("hiring.viewPage")}
        </Link>
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
