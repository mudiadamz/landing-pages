/**
 * Best-effort guards to discourage copying/downloading preview content.
 * These run inside the preview iframe. They cannot fully prevent a determined
 * user (the HTML is delivered to the browser), but they block the common paths:
 * right-click "Save as", text selection/copy, image drag, and the usual
 * save/print/view-source/devtools keyboard shortcuts.
 */

const GUARD_STYLE = `
<style id="__preview_guard__">
  * {
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    user-select: none !important;
    -webkit-touch-callout: none !important;
  }
  input, textarea, [contenteditable="true"] {
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
    user-select: text !important;
  }
  img, video, picture, source {
    -webkit-user-drag: none !important;
    user-drag: none !important;
  }
</style>
`;

const GUARD_SCRIPT = `
<script>
(function () {
  function isEditable(t) {
    if (!t || !t.tagName) return false;
    var tag = t.tagName.toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
  }
  function block(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
  ["contextmenu", "copy", "cut", "dragstart"].forEach(function (evt) {
    document.addEventListener(evt, block, true);
  });
  document.addEventListener("selectstart", function (e) {
    if (isEditable(e.target)) return;
    return block(e);
  }, true);
  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if (e.key === "F12") return block(e);
    if (e.ctrlKey || e.metaKey) {
      if (["s", "u", "p"].indexOf(k) !== -1) return block(e);
      if (!isEditable(e.target) && ["c", "x", "a"].indexOf(k) !== -1) return block(e);
      if (e.shiftKey && ["i", "j", "c"].indexOf(k) !== -1) return block(e);
    }
  }, true);

  // When a <base href> points at storage (ZIP-uploaded sites), in-page anchor
  // links like href="#section" would otherwise navigate to the base URL and
  // break the preview. Intercept them and scroll within the document instead.
  document.addEventListener("click", function (e) {
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href^="#"]') : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href === "#" || href.charAt(0) !== "#") {
      if (href === "#") { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }
      return;
    }
    var id = href.slice(1);
    var el = document.getElementById(id) ||
      document.querySelector('[name="' + id.replace(/"/g, '\\"') + '"]');
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, true);
})();
</script>
`;

/** Inject anti-copy/download guards into an arbitrary HTML document string. */
export function guardPreviewHtml(html: string): string {
  const injection = GUARD_STYLE + GUARD_SCRIPT;

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, injection + "</head>");
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body[^>]*>/i, (m) => m + injection);
  }
  return injection + html;
}
