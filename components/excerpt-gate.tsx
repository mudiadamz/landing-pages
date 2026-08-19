"use client";

import { useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n/client";
import {
  getExcerptMeta,
  getExcerptMetaServer,
  minutesLeft,
  percentShown,
  subscribeExcerptMeta,
} from "@/lib/excerpt-store";

/**
 * The wall at the end of a gated preview.
 *
 * The panel this sits above was written for a book the reader FINISHED — it
 * opens with a quiet "• • •" and treats the purchase as an afterthought. That is
 * exactly wrong here. A reader who hits a gate was interrupted mid-story, and
 * the honest, and incidentally the converting, thing to do is say so plainly and
 * immediately: how far they got, how much is left, and what it costs to keep
 * going. Pretending the excerpt "ended" is both a lie and a lost sale.
 *
 * Why the numbers are live rather than rendered on the server: only the archive
 * knows its own spine length, and unzipping a book to count chapters on the
 * preview page would put an archive read on the critical path of the page ad
 * traffic lands on. The reader already has the counts; it publishes them (see
 * lib/excerpt-store.ts) and this reads them.
 *
 * Static copy renders first and stays correct if the numbers never arrive, so a
 * failed fetch degrades to a plain gate rather than to "0 dari 0 bab".
 */
export function ExcerptGate() {
  const t = useT();
  const meta = useSyncExternalStore(
    subscribeExcerptMeta,
    getExcerptMeta,
    getExcerptMetaServer,
  );

  const pct = meta ? percentShown(meta) : null;
  const chaptersLeft = meta ? meta.totalChapters - meta.shownChapters : null;
  const mins = meta ? minutesLeft(meta) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      {/* The fade is the whole point: the text above does not stop, it dissolves,
          so the gate reads as an interruption rather than an ending. */}
      <div className="relative -mt-px h-16 bg-gradient-to-b from-transparent to-[var(--card)]" />

      <div className="px-5 pb-5 -mt-8 sm:px-6 sm:pb-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-[var(--primary)]">
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </span>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            {t("reader.freeExcerpt")}
          </p>
        </div>

        <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {chaptersLeft && chaptersLeft > 0
            ? t("reader.chaptersLeft", { count: chaptersLeft })
            : t("reader.storyUnfinished")}
        </h2>

        <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
          {meta ? (
            <>
              {t("reader.readSoFar")} <strong className="text-foreground">{pct}%</strong>{" "}
              {t("reader.ofThisBook")}
              {mins ? (
                <>
                  {" "}
                  {t("reader.remainingAbout")}{" "}
                  <strong className="text-foreground">{t("reader.minutes", { mins })}</strong>{" "}
                  {t("reader.ofReading")}
                </>
              ) : null}
              {t("reader.restInFullBook")}
            </>
          ) : (
            <>{t("reader.excerptOnly")}</>
          )}
        </p>

        {/* Progress is the argument. A number can be discounted; a bar that is
            mostly empty is felt. */}
        {meta && pct !== null && (
          <div className="mt-4">
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--background)]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("reader.readProgress")}
            >
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[0.6875rem] text-[var(--muted)]">
              <span>
                {t("reader.chaptersOf", {
                  shown: meta.shownChapters,
                  total: meta.totalChapters,
                })}
              </span>
              <span>{t("reader.percentLocked", { pct: 100 - pct })}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
