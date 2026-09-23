import { describe, expect, it } from "vitest";
import { DEFAULT_SKIN, SKIN_PRESETS, normalizeSkin, skinCss, skinFromKey } from "@/lib/skin";

/**
 * The visual-style axis (lib/skin.ts).
 *
 * The thing most worth pinning is not what Flat looks like — that is taste — but
 * that GLASS EMITS ITS VALUES rather than emitting nothing. The storefront's
 * style is written by the root layout and the panel's by the panel layout after
 * it; if the default were silent, a Flat storefront would leak square corners
 * into a Glass panel, and the two scopes would not really be independent.
 */

describe("normalizeSkin", () => {
  it("accepts the keys that exist, case-insensitively", () => {
    expect(normalizeSkin("glass")).toBe("glass");
    expect(normalizeSkin(" FLAT ")).toBe("flat");
  });

  it("anything unknown falls back to the default, never throws", () => {
    for (const bad of ["brutalist", "", null, undefined, 7, {}]) {
      expect(normalizeSkin(bad)).toBe(DEFAULT_SKIN);
    }
  });

  it("the default is glass — today's look, so the feature ships invisible", () => {
    expect(DEFAULT_SKIN).toBe("glass");
  });
});

describe("skinCss", () => {
  it("every preset emits the FULL token set, including the default", () => {
    // The independence of the two scopes rests on this: later-wins only works
    // if the later one actually says something.
    for (const preset of SKIN_PRESETS) {
      const css = skinCss(preset.key);
      for (const token of ["--radius-md", "--radius-lg", "--radius-xl", "--radius-2xl", "--blur-sm", "--blur-md", "--blur-xl"]) {
        expect(css, `${preset.key} must set ${token}`).toContain(`${token}:`);
      }
      expect(css, `${preset.key} must override .shadow-sm`).toContain(".shadow-sm{--tw-shadow:");
      expect(css, `${preset.key} must override .shadow-lg`).toContain(".shadow-lg{--tw-shadow:");
      // The bare utility hardcodes 8px instead of reading a variable, so it
      // needs saying separately or the frosted bars survive a flat skin.
      expect(css, `${preset.key} must override .backdrop-blur`).toContain(".backdrop-blur{");
    }
  });

  it("glass reproduces Tailwind's compiled defaults exactly", () => {
    // Lifted from the built stylesheet. If Tailwind's scale ever changes these,
    // this test is the thing that notices.
    const css = skinCss("glass");
    expect(css).toContain("--radius-md:0.375rem");
    expect(css).toContain("--radius-lg:0.5rem");
    expect(css).toContain("--radius-xl:0.75rem");
    expect(css).toContain("--radius-2xl:1rem");
    expect(css).toContain("--blur-sm:8px");
    expect(css).toContain("--blur-md:12px");
    expect(css).toContain("--blur-xl:24px");
  });

  it("flat switches off the three things that make it read as glass", () => {
    const css = skinCss("flat");
    expect(css, "no blur").toContain("--blur-md:0");
    expect(css, "no depth").toContain(".shadow-sm{--tw-shadow:0 0 #0000}");
    expect(css, "no depth").toContain(".shadow-lg{--tw-shadow:0 0 #0000}");
    expect(css, "bare backdrop-blur too").toContain(".backdrop-blur{--tw-backdrop-blur:blur(0)}");
  });

  it("flat is tighter but NOT square — square is a different style entirely", () => {
    const css = skinCss("flat");
    expect(css).toContain("--radius-xl:0.5rem");
    // Terminator included on purpose: "--radius-xl:0" is a prefix of
    // "--radius-xl:0.5rem", so the loose check passes for any value at all.
    expect(css).not.toMatch(/--radius-xl:0[;}]/);
    expect(css).not.toMatch(/--radius-md:0[;}]/);
  });

  it("an unknown key renders as the default rather than emitting nothing", () => {
    expect(skinCss("nonsense")).toBe(skinCss("glass"));
  });

  it("produces no HTML-breaking characters — it goes into a <style> tag", () => {
    for (const preset of SKIN_PRESETS) {
      expect(skinCss(preset.key)).not.toMatch(/[<>]/);
    }
  });
});

describe("skinFromKey", () => {
  it("returns the preset, with a label and a note for the picker", () => {
    const flat = skinFromKey("flat");
    expect(flat.key).toBe("flat");
    expect(flat.label.length).toBeGreaterThan(0);
    expect(flat.note.length).toBeGreaterThan(0);
  });

  it("never returns undefined for a bad key", () => {
    expect(skinFromKey(undefined).key).toBe(DEFAULT_SKIN);
  });
});
