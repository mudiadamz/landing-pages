import { describe, expect, it } from "vitest";
import { sanitizePageHtml } from "@/lib/page-html";

/**
 * The page editor stores HTML that is later rendered with
 * dangerouslySetInnerHTML. An admin wrote it, so this is not a boundary against
 * them — it is a boundary against a pasted widget becoming a permanent script on
 * every visitor's page, invisible in the editor.
 */
describe("sanitizePageHtml", () => {
  it("keeps the rich text that makes a page a page", () => {
    const html = '<h2>Judul</h2><p>Teks <strong>tebal</strong> dan <a href="https://a.test">tautan</a>.</p><ul><li>satu</li></ul>';
    expect(sanitizePageHtml(html)).toBe(html);
  });

  it("removes a pasted script entirely, not just its tags", () => {
    const out = sanitizePageHtml('<p>ok</p><script>fetch("https://evil.test")</script>');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("evil.test");
    expect(out).toContain("<p>ok</p>");
  });

  it("removes embeds that execute", () => {
    for (const tag of ["iframe", "object", "embed"]) {
      const out = sanitizePageHtml(`<p>a</p><${tag} src="https://x.test"></${tag}>`);
      expect(out, tag).not.toContain(`<${tag}`);
    }
  });

  it("strips inline event handlers", () => {
    const out = sanitizePageHtml('<p onclick="steal()">teks</p><img onerror="steal()" src="x.png">');
    expect(out).not.toMatch(/onclick|onerror/i);
    expect(out).toContain("teks");
  });

  it("strips javascript: urls but keeps the element", () => {
    const out = sanitizePageHtml('<a href="javascript:alert(1)">klik</a>');
    expect(out).not.toContain("javascript:");
    expect(out).toContain("klik");
  });

  it("survives empty and absurd input", () => {
    expect(sanitizePageHtml("")).toBe("");
    expect(sanitizePageHtml("x".repeat(300_000)).length).toBeLessThanOrEqual(200_000);
  });
});
