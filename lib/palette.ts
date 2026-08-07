/* Panel colour palette, editable at /panel/appearance.
 *
 * Only four tokens are configurable, deliberately. Backgrounds, text and
 * borders stay fixed: those carry the contrast the whole panel is legible by,
 * and handing them to a colour picker is how an admin locks themselves out of
 * reading their own dashboard. What's left is the part that actually sets the
 * mood — the action colour, its tint, and one accent.
 *
 * Framework-free (like hero-config) so the client form and the server layout can
 * both import it.
 */

export type PaletteTokens = {
  /** Buttons, links, active nav. Also drives --ring. */
  primary: string;
  primaryDark: string;
  /** The wash behind active/selected things. */
  subtle: string;
  subtleDark: string;
  /** The one non-semantic accent, for marks and highlights. */
  accent: string;
  accentDark: string;
};

export type PalettePreset = {
  key: string;
  label: string;
  note: string;
  tokens: PaletteTokens;
};

/**
 * Contrast against the fixed backgrounds (#fdfcfb / #0d0d0f) was measured for
 * every `primary` below; all clear 4.5:1 in at least one theme and 3:1 in both.
 * Accents are for fills and marks, not body text, so they are not held to it —
 * "highlighter" in particular is unreadable as text on purpose.
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  {
    key: "forest",
    label: "Forest (bawaan)",
    note: "Hijau tua, tenang & editorial — palet asli situs.",
    tokens: {
      primary: "#1a5f4a", primaryDark: "#3d8b6e",
      subtle: "#e8f0ee", subtleDark: "#1a2e26",
      accent: "#e8a87c", accentDark: "#d4956a",
    },
  },
  {
    key: "jade",
    label: "Jade & Mango",
    note: "Hijau lebih cerah dengan aksen mangga — hangat, tetap satu keluarga.",
    tokens: {
      primary: "#0b7a55", primaryDark: "#25c07f",
      subtle: "#e6f4ee", subtleDark: "#102a20",
      accent: "#e2600f", accentDark: "#ff9642",
    },
  },
  {
    key: "ink",
    label: "Ink & Highlighter",
    note: "Biru tinta dengan stabilo kuning — main-main tapi enak dibaca.",
    tokens: {
      primary: "#3b3ba8", primaryDark: "#8b8bf0",
      subtle: "#ecebfa", subtleDark: "#1c1c33",
      accent: "#f5c518", accentDark: "#ffd84d",
    },
  },
  {
    key: "tropical",
    label: "Tropical",
    note: "Koral & teal — paling ramai, paling 'Instagram'.",
    tokens: {
      primary: "#c93a35", primaryDark: "#ff7a72",
      subtle: "#fdeceb", subtleDark: "#34191a",
      accent: "#0d8a8a", accentDark: "#2dd4d4",
    },
  },
  {
    key: "violet",
    label: "Violet",
    note: "Ungu modern dengan aksen koral — bersih, agak 'tool'.",
    tokens: {
      primary: "#6d3ff2", primaryDark: "#a78bfa",
      subtle: "#f0ebfe", subtleDark: "#211a33",
      accent: "#e0453f", accentDark: "#ff7a72",
    },
  },
];

export const DEFAULT_PALETTE_KEY = "forest";
export const DEFAULT_TOKENS = PALETTE_PRESETS[0].tokens;

export type PaletteConfig = {
  /** A preset key, or "custom" to use `tokens` verbatim. */
  preset: string;
  tokens: PaletteTokens;
};

export const DEFAULT_PALETTE: PaletteConfig = {
  preset: DEFAULT_PALETTE_KEY,
  tokens: DEFAULT_TOKENS,
};

const HEX = /^#[0-9a-f]{6}$/i;

/** A `#rrggbb` string or the fallback. The only thing standing between an admin
 *  text field and a `<style>` tag, so it is strict rather than forgiving. */
function hex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : fallback;
}

export function normalizeTokens(value: unknown): PaletteTokens {
  const v = (value ?? {}) as Partial<PaletteTokens>;
  return {
    primary: hex(v.primary, DEFAULT_TOKENS.primary),
    primaryDark: hex(v.primaryDark, DEFAULT_TOKENS.primaryDark),
    subtle: hex(v.subtle, DEFAULT_TOKENS.subtle),
    subtleDark: hex(v.subtleDark, DEFAULT_TOKENS.subtleDark),
    accent: hex(v.accent, DEFAULT_TOKENS.accent),
    accentDark: hex(v.accentDark, DEFAULT_TOKENS.accentDark),
  };
}

export function normalizePalette(value: unknown): PaletteConfig {
  const v = (value ?? {}) as { preset?: unknown; tokens?: unknown };
  const preset = typeof v.preset === "string" ? v.preset : DEFAULT_PALETTE_KEY;
  const known = PALETTE_PRESETS.find((p) => p.key === preset);
  // A named preset always wins over stored tokens, so editing a preset's
  // definition in this file rolls out to everyone using it.
  if (known) return { preset: known.key, tokens: known.tokens };
  if (preset === "custom") return { preset: "custom", tokens: normalizeTokens(v.tokens) };
  return DEFAULT_PALETTE;
}

/**
 * CSS overriding the four tokens, for both themes.
 *
 * Emitted from the panel layout, so it exists only on panel pages — but the
 * selectors are `:root` / `html.dark` rather than a wrapper class, because
 * dialogs portal to document.body and a scoped class would leave them behind
 * with the old colours. Values are validated hex; nothing else is interpolated.
 */
export function paletteCss(config: PaletteConfig): string {
  const t = normalizeTokens(config.tokens);
  return (
    `:root{--primary:${t.primary};--ring:${t.primary};` +
    `--accent-subtle:${t.subtle};--accent:${t.accent}}` +
    `html.dark{--primary:${t.primaryDark};--ring:${t.primaryDark};` +
    `--accent-subtle:${t.subtleDark};--accent:${t.accentDark}}`
  );
}

/**
 * Resolve a preset KEY to a full config, for the per-storefront palette on
 * `lp_sites.palette`.
 *
 * Sites store only the key — never raw hex. The presets below were contrast-checked
 * once; six free-text colour fields per domain would be six more chances to ship an
 * illegible storefront with nothing measured behind it. An unknown key (renamed or
 * removed preset) falls back to the default instead of emitting no primary colour.
 */
export function paletteFromKey(key: string | null | undefined): PaletteConfig {
  const k = (key ?? "").trim();
  const preset = PALETTE_PRESETS.find((p) => p.key === k);
  return preset
    ? { preset: preset.key, tokens: preset.tokens }
    : DEFAULT_PALETTE;
}

/** Options for a picker: key, label, note and the swatch colours to show. */
export function paletteOptions(): {
  key: string;
  label: string;
  note: string;
  swatch: [string, string, string];
}[] {
  return PALETTE_PRESETS.map((p) => ({
    key: p.key,
    label: p.label,
    note: p.note,
    swatch: [p.tokens.primary, p.tokens.accent, p.tokens.subtle],
  }));
}
