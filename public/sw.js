/*
 * Minimal service worker. Its only job is to satisfy the browser's PWA
 * installability requirement (a registered SW with a fetch handler) so
 * "Add to Home Screen" / install prompts become available. It deliberately does
 * NO caching — every request passes straight through to the network — to avoid
 * ever serving stale app content.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A fetch listener must exist for installability; passing through (no
// respondWith) leaves normal network behaviour untouched.
self.addEventListener("fetch", () => {});
