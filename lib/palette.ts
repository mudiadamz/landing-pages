/* Panel colour palette, editable at /panel/appearance.
 *
 * Only the mood tokens are configurable, deliberately. Backgrounds, text and
 * borders stay fixed here: those carry the contrast the whole panel is legible
 * by, and handing them to a colour picker is how an admin locks themselves out
 * of reading their own dashboard. What's left is the part that actually sets the
 * mood — the action colour, its tint, and two accents.
 *
 * A TEMPLATE may still declare its own page/card surfaces (see registry
 * `surfaces`); that is a fixed, contrast-checked pair chosen by whoever wrote
 * the template, not a field anyone types into.
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
  /**
   * A second accent, so a palette can carry three colours rather than two.
   *
   * Two colours forces every secondary surface to be a tint of the primary,
   * which is why the flat templates read as one hue with the volume changed.
   * This one is for the surfaces that are neither the action nor the highlight:
   * a chip, a tag, an alternating row.
   */
  secondary: string;
  secondaryDark: string;
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
      secondary: "#c2410c", secondaryDark: "#fb923c",
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
      secondary: "#0369a1", secondaryDark: "#38bdf8",
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
      secondary: "#be185d", secondaryDark: "#f472b6",
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
      secondary: "#7c3aed", secondaryDark: "#a78bfa",
    },
  },
  {
    key: "breeze",
    label: "Breeze",
    note: "Teal laut dengan aksen ungu-biru — sejuk, segar, hidup. Dipakai Link in bio.",
    tokens: {
      // 5.1:1 on the light background. The teal is the whole mood here, so it
      // had to be the readable one rather than the bright one.
      primary: "#0f766e", primaryDark: "#2dd4bf",
      subtle: "#e3f6f2", subtleDark: "#0f2e2a",
      // A different hue from the primary on purpose: two neighbouring teals read
      // as one colour that failed, and the accent is what makes it lively.
      accent: "#7c3aed", accentDark: "#a78bfa",
      secondary: "#e11d48", secondaryDark: "#fb7185",
    },
  },
  {
    key: "brick",
    label: "Brick Wall",
    note: "Bata merah, mortar oker & patina tembaga — hangat, earthy, sedikit industrial.",
    tokens: {
      // 6.5:1 on the light background, 7.5:1 on the dark one — measured, not
      // eyeballed. A brick that reads as brick rather than as a warning colour.
      primary: "#9c3f2b", primaryDark: "#e08b6f",
      // The mortar line: warm, barely there, so a filled row still looks like wall.
      subtle: "#f7ebe6", subtleDark: "#33201b",
      // Copper patina — the green that actually turns up on old brickwork, and
      // the one hue that stops three warm tones reading as one.
      accent: "#3f6b6b", accentDark: "#6fb0ac",
      secondary: "#a86a2e", secondaryDark: "#e0a862",
    },
  },
  {
    key: "corporate",
    label: "Corporate Blue",
    note: "Biru navy dengan aksen cyan & bronze — tenang, rapi, cocok untuk produk B2B, template bisnis, atau materi profesional.",
    tokens: {
      // 8.2:1 on the light background, 8.7:1 on the dark — measured. Navy rather
      // than a bright royal blue: the bright one is a link colour, and every
      // heading painted in it reads as something to click.
      primary: "#1e4d8c", primaryDark: "#7fb0f2",
      subtle: "#e9eff8", subtleDark: "#152233",
      // Cyan for marks, close enough to stay in the family and far enough to be
      // seen against the navy.
      accent: "#0e7490", accentDark: "#3fc4dd",
      // The one warm note. Three cool tones would be a single blue wash with the
      // brightness changed, which is the failure this third colour exists to fix.
      secondary: "#b45309", secondaryDark: "#e8a15c",
    },
  },
  {
    key: "wayang",
    label: "Wayang",
    note: "Hijau tua, emas & kertas tua — Jawa klasik. Palet MbahGPT.",
    tokens: {
      // 8.9:1 on the light background. Lifted off the poster's near-black green
      // on purpose: at #14382c a link reads as body text that happens to be
      // underlined, and the whole theme's one action colour cannot be a colour
      // nobody sees as a colour.
      primary: "#1a4a37", primaryDark: "#7ab894",
      // Warm, not neutral: a grey-green wash on a paper ground reads as a stain.
      subtle: "#e9dfc6", subtleDark: "#16241d",
      // Brass rather than yellow gold. It is for marks, rules and ornament —
      // never body text, where 3.6:1 on paper would be a promise it cannot keep.
      accent: "#a8801f", accentDark: "#d9b74e",
      // The batik brown that keeps green-and-gold from reading as two metals.
      secondary: "#7a4f2a", secondaryDark: "#c9955f",
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
      secondary: "#0d9488", secondaryDark: "#2dd4bf",
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
    secondary: hex(v.secondary, DEFAULT_TOKENS.secondary),
    secondaryDark: hex(v.secondaryDark, DEFAULT_TOKENS.secondaryDark),
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
    `--accent-subtle:${t.subtle};--accent:${t.accent};--secondary:${t.secondary}}` +
    `html.dark{--primary:${t.primaryDark};--ring:${t.primaryDark};` +
    `--accent-subtle:${t.subtleDark};--accent:${t.accentDark};--secondary:${t.secondaryDark}}`
  );
}

/**
 * Page and card colours a template may set for itself.
 *
 * Separate from the palette on purpose: the palette is per-domain and picked in
 * the panel, while these belong to the template's design and are checked once by
 * whoever wrote it. Light values only — a template that wants its own surfaces
 * is light-only in practice, and globals.css keeps `html.dark` more specific, so
 * dark mode is unaffected either way.
 */
export type Surfaces = {
  background: string;
  card: string;
  /**
   * The ORNAMENTAL hairline, when a template has an identity that draws them.
   * Optional because most templates do not: left out, `--rule` keeps the
   * globals.css default, which is `--border`, and nothing looks different.
   *
   * It belongs to the template rather than the palette for the same reason the
   * surfaces do — it is a fixed choice by whoever designed the theme, not a mood
   * an admin picks per domain. Emitted at :root so the storefront's OTHER pages
   * (header, footer, checkout, legal) get it too; a token defined only inside
   * the template's own wrapper would leave every one of those drawing a
   * decorative border in currentColor.
   */
  rule?: string;
};

/** What the panel re-asserts, so a storefront's surfaces never reach the admin UI. */
export const PANEL_SURFACES: Surfaces = { background: "#fdfcfb", card: "#ffffff" };

export function surfaceCss(s: Surfaces): string {
  return (
    `:root{--background:${hex(s.background, PANEL_SURFACES.background)};` +
    `--card:${hex(s.card, PANEL_SURFACES.card)}` +
    // Only when the template asked for one: an absent rule must leave the
    // globals.css default standing, not overwrite it with a fallback.
    `${s.rule ? `;--rule:${hex(s.rule, PANEL_SURFACES.card)}` : ""}}`
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
