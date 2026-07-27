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

  // Report position to the parent: it drives the page readout at the bottom of
  // the preview, and tells the host chrome that scrolling is happening (the
  // preview scrolls inside this iframe, where the host can't observe it).
  // Screenfuls, not pages — an HTML demo has no page structure to count.
  var __lpTick = false;
  function __lpReport() {
    __lpTick = false;
    try {
      var de = document.documentElement || {};
      var y = window.pageYOffset || de.scrollTop || 0;
      var vh = window.innerHeight || de.clientHeight || 0;
      var sh = de.scrollHeight || 0;
      var max = sh - vh;
      // Fraction scrolled through the whole document (1 when it doesn't scroll).
      var prog = max > 0 ? y / max : 1;
      var total = vh > 0 ? Math.max(1, Math.ceil(sh / vh)) : 1;
      var page = vh > 0 ? Math.min(total, Math.max(1, Math.ceil((y + vh) / vh))) : 1;
      window.parent.postMessage({ __lpPreview: 1, prog: prog, page: page, total: total }, "*");
    } catch (err) {}
  }
  window.addEventListener("scroll", function () {
    if (__lpTick) return;
    __lpTick = true;
    (window.requestAnimationFrame || function (f) { return setTimeout(f, 100); })(__lpReport);
  }, { passive: true });

  // Dark mode, toggled by the parent (PreviewSurface) via postMessage. Invert
  // the whole page, then RE-invert raster media so images/photos/video keep
  // their real colours — this avoids the "negative photo" look of a naive
  // full-page invert. Only affects this preview document, never the host page.
  var __lpDarkEl = null;
  function __lpSetDark(on) {
    if (on) {
      if (!__lpDarkEl) {
        __lpDarkEl = document.createElement("style");
        __lpDarkEl.setAttribute("data-lp-dark", "");
        __lpDarkEl.textContent =
          "html{background-color:#fff !important;filter:invert(1) hue-rotate(180deg);}" +
          "img,picture,video,canvas,[style*='background-image'],[style*='background:url'],[style*='background: url']{filter:invert(1) hue-rotate(180deg);}";
        (document.head || document.documentElement).appendChild(__lpDarkEl);
      }
    } else if (__lpDarkEl) {
      __lpDarkEl.parentNode && __lpDarkEl.parentNode.removeChild(__lpDarkEl);
      __lpDarkEl = null;
    }
  }
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (d && typeof d === "object" && "__lpSetDark" in d) __lpSetDark(!!d.__lpSetDark);
  });
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
