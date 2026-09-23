"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePanelPalette, updatePanelSkin } from "@/lib/actions/site-settings";
import { SKIN_PRESETS } from "@/lib/skin";
import {
  PALETTE_PRESETS,
  normalizeTokens,
  paletteCss,
  type PaletteConfig,
  type PaletteTokens,
} from "@/lib/palette";
import { Button } from "@/components/ui/button";
import { SaveBar } from "@/components/ui/save-bar";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n";

/**
 * Palette picker with a live preview.
 *
 * The preview is the whole point: a swatch grid tells you nothing about what a
 * colour does to a button next to a badge next to a muted caption. Selecting a
 * preset re-emits the same CSS the layout emits, at the same `:root` selector
 * but later in the document, so the panel around you recolours instantly and
 * you are judging the real thing rather than a picture of it. Nothing is stored
 * until Save.
 */

const FIELDS: { key: keyof PaletteTokens; labelKey: MessageKey }[] = [
  { key: "primary", labelKey: "panel.palettePrimaryLight" },
  { key: "primaryDark", labelKey: "panel.palettePrimaryDark" },
  { key: "subtle", labelKey: "panel.paletteSubtleLight" },
  { key: "subtleDark", labelKey: "panel.paletteSubtleDark" },
  { key: "accent", labelKey: "panel.paletteAccentLight" },
  { key: "accentDark", labelKey: "panel.paletteAccentDark" },
  { key: "secondary", labelKey: "panel.paletteSecondaryLight" },
  { key: "secondaryDark", labelKey: "panel.paletteSecondaryDark" },
];

export function AppearanceForm({
  initial,
  initialSkin,
}: {
  initial: PaletteConfig;
  initialSkin: string;
}) {
  const t = useT();
  const router = useRouter();
  const [preset, setPreset] = useState(initial.preset);
  const [skin, setSkin] = useState(initialSkin);
  const [tokens, setTokens] = useState<PaletteTokens>(initial.tokens);
  const [saving, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty =
    preset !== initial.preset ||
    skin !== initialSkin ||
    JSON.stringify(tokens) !== JSON.stringify(initial.tokens);

  const choose = (key: string) => {
    setPreset(key);
    setMsg(null);
    const p = PALETTE_PRESETS.find((x) => x.key === key);
    if (p) setTokens(p.tokens);
  };

  const editToken = (key: keyof PaletteTokens, value: string) => {
    setPreset("custom");
    setMsg(null);
    setTokens((t) => ({ ...t, [key]: value }));
  };

  function save() {
    setMsg(null);
    start(async () => {
      // Two stores, so two writes. The style goes first: if the palette write
      // then fails, the user sees an error with the style already applied, which
      // is a visible and correctable state — the reverse would look like the
      // style silently refused to change.
      const skinRes = skin !== initialSkin ? await updatePanelSkin(skin) : { ok: true as const };
      const res = !skinRes.ok
        ? skinRes
        : await updatePanelPalette({ preset, tokens: normalizeTokens(tokens) });
      setMsg(
        res.ok
          ? { ok: true, text: t("panel.paletteSaved") }
          : { ok: false, text: ("error" in res && res.error) || t("common.failed") },
      );
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Later in the document than the layout's tag, same selector, so it wins
          while you're choosing. */}
      <style dangerouslySetInnerHTML={{ __html: paletteCss({ preset, tokens }) }} />

      <div className="grid gap-3 sm:grid-cols-2">
        {PALETTE_PRESETS.map((p) => {
          const active = preset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => choose(p.key)}
              aria-pressed={active}
              className={`rounded-xl border p-4 text-left transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--accent-subtle)]"
                  : "border-[var(--border)] bg-[var(--card)] hover:bg-[var(--background)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Swatch color={p.tokens.primary} />
                <Swatch color={p.tokens.subtle} />
                <Swatch color={p.tokens.accent} />
                <Swatch color={p.tokens.secondary} />
                <Swatch color={p.tokens.primaryDark} />
                <span className="ml-auto text-xs font-medium text-[var(--primary)]">
                  {active ? "Dipakai" : ""}
                </span>
              </div>
              <p className="mt-2.5 text-sm font-semibold text-foreground">{p.label}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{p.note}</p>
            </button>
          );
        })}
      </div>

      <details className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          {t("panel.customColors")} {preset === "custom" && t("panel.activeSuffix")}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-2">
              <input
                type="color"
                value={tokens[f.key]}
                onChange={(e) => editToken(f.key, e.target.value)}
                aria-label={t(f.labelKey)}
                className="h-9 w-12 shrink-0 cursor-pointer rounded border border-[var(--border)] bg-transparent"
              />
              <div className="min-w-0 flex-1">
                <label htmlFor={`palette-${f.key}`} className="block text-xs text-[var(--muted)]">{t(f.labelKey)}</label>
                <input
                  id={`palette-${f.key}`}
                  type="text"
                  value={tokens[f.key]}
                  onChange={(e) => editToken(f.key, e.target.value)}
                  className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 font-mono text-base sm:text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {t("panel.appearanceHint")}
        </p>
      </details>

      {/* Real components, not swatches. */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          {t("panel.preview")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="md">{t("panel.primaryButton")}</Button>
          <Button variant="secondary" size="md">
            {t("panel.secondary")}
          </Button>
          <span className="rounded-lg bg-[var(--accent-subtle)] px-3 py-1.5 text-sm font-medium text-[var(--primary)]">
            {t("panel.activeMenu")}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold"
            style={{ background: "var(--accent)", color: "#1d1d1f" }}
          >
            {t("panel.accent")}
          </span>
          <a href="#preview" className="text-sm font-medium text-[var(--primary)] hover:underline">
            {t("panel.link")}
          </a>
          <span className="text-sm text-[var(--muted)]">{t("panel.secondaryText")}</span>
        </div>
      </div>

      {/* Style, under the colours: the same screen answers "what does my panel
          look like", and these are the two halves of that. Each option previews
          ITSELF with inline styles, because utility classes here would be
          repainted by whichever skin the panel is already wearing. */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-foreground">{t("sites.skinLabel")}</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {SKIN_PRESETS.map((sk) => {
            const active = skin === sk.key;
            const flat = sk.key === "flat";
            return (
              <button
                key={sk.key}
                type="button"
                onClick={() => {
                  setSkin(sk.key);
                  setMsg(null);
                }}
                aria-pressed={active}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)]/5 ring-1 ring-[var(--primary)]/30"
                    : "border-[var(--border)] hover:bg-[var(--background)]"
                }`}
              >
                <span
                  aria-hidden
                  className="mt-0.5 h-10 w-10 shrink-0 border border-[var(--border)] bg-[var(--card)]"
                  style={
                    flat
                      ? { borderRadius: "0.25rem", boxShadow: "none" }
                      : { borderRadius: "0.75rem", boxShadow: "0 2px 6px rgba(0,0,0,0.14)" }
                  }
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{sk.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">{sk.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        saveLabel={t("panel.savePalette")}
        savingLabel={t("common.saving")}
        unsavedLabel={t("common.unsavedChanges")}
        saved={!!msg?.ok}
        savedLabel={msg?.ok ? msg.text : t("panel.paletteSaved")}
        error={msg && !msg.ok ? msg.text : null}
      />
    </div>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      className="h-6 w-6 rounded-full border border-black/10 dark:border-white/15"
      style={{ background: color }}
      aria-hidden
    />
  );
}
