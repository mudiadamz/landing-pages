/**
 * Server-rendered cover splash. This is deliberately NOT a client component:
 * it ships in the initial HTML so the cover is on screen at first paint,
 * before any JavaScript has loaded. (The reader itself is a ssr:false dynamic
 * import, so a splash inside it could only appear after the bundle had
 * downloaded — by which time the book is nearly ready and the splash just
 * flashes.)
 *
 * EpubInlineViewer removes this node once the book is injected; the CSS also
 * self-dismisses after a while so a failed script can't trap the reader.
 */
export function EpubBootSplash({
  coverUrl,
  thumbnailUrl,
  title,
}: {
  /** The book's own cover (see /api/epub-cover); preferred over the listing art. */
  coverUrl?: string | null;
  thumbnailUrl?: string | null;
  title?: string;
}) {
  const src = coverUrl ?? thumbnailUrl;
  return (
    <div id="epub-boot" className="epub-boot epub-surface" aria-hidden>
      {thumbnailUrl && (
        <div
          className="epub-boot-wash"
          style={{ backgroundImage: `url(${thumbnailUrl})` }}
        />
      )}
      <div className="epub-boot-inner">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            fetchPriority="high"
            decoding="sync"
            className="epub-boot-cover"
          />
        ) : (
          title && <p className="epub-boot-title">{title}</p>
        )}
        <div className="epub-boot-dots">
          <span className="epub-splash-dot" />
          <span className="epub-splash-dot" />
          <span className="epub-splash-dot" />
        </div>
      </div>
    </div>
  );
}
