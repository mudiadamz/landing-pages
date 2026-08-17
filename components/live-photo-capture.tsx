"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/client";

/**
 * Take a photo with the device camera. No file input anywhere, by design: the
 * point of a "live" KTP photo and a "live" selfie is that the applicant is
 * holding the document now, not uploading a picture of someone else's that has
 * been sitting in their gallery.
 *
 * Worth being honest about the limit: this stops a casual gallery upload, not a
 * determined spoof. A virtual camera can feed anything into getUserMedia, and
 * nothing in the browser can tell the difference. It raises the effort, and the
 * admin still looks at both photos before approving.
 *
 * The stream is stopped the moment a frame is captured and on unmount, so the
 * camera light never stays on after the component is done with it.
 */

const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.85;

type Facing = "user" | "environment";

export function LivePhotoCapture({
  label,
  hint,
  facing,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  /** "user" = selfie camera, "environment" = rear camera for the card. */
  facing: Facing;
  /** Captured JPEG as a data URL, or null. */
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  // The stream is attached but has not reported its dimensions yet. Capturing
  // in that state silently produces nothing, so the button waits for it.
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
    setReady(false);
  }, []);

  // Never leave the camera running behind a closed page.
  useEffect(() => stop, [stop]);

  /**
   * Attach the stream once the <video> is actually in the DOM.
   *
   * This used to happen in a requestAnimationFrame right after setLive(true),
   * which raced React: the frame callback can run before the re-render that
   * mounts the element is committed, leaving videoRef null and the preview
   * blank. It showed up on the FIRST grant in particular — after the permission
   * prompt resolves, the commit lands late enough to lose the race, while a
   * second attempt (no prompt) usually won it. An effect runs after commit by
   * definition, so the race is gone rather than narrowed.
   */
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!live || !video || !stream) return;

    video.srcObject = stream;
    const onMeta = () => setReady(video.videoWidth > 0);
    video.addEventListener("loadedmetadata", onMeta);
    // Some browsers have metadata before the listener is attached.
    if (video.videoWidth > 0) setReady(true);
    // Muted + playsInline, so this is allowed without a gesture; a rejection
    // here means the element went away mid-start, which stop() already handles.
    video.play().catch(() => {});

    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [live]);

  async function start() {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setLive(true); // the effect above attaches it once the <video> exists
    } catch (err) {
      const name = (err as DOMException)?.name;
      setError(
        name === "NotAllowedError"
          ? t("panel.cameraDenied")
          : name === "NotFoundError"
            ? t("panel.cameraMissing")
            : t("panel.cameraFailed"),
      );
    } finally {
      setStarting(false);
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    // Downscale on the way out: a 1280px JPEG is plenty to read a KTP, and the
    // photo travels to the server inside a form post.
    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    onChange(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    stop();
  }

  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[var(--background)]">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : live ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              // Mirroring only the selfie view — a mirrored KTP is unreadable.
              className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`}
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--background)]/70">
                <p className="text-xs text-[var(--muted)]">{t("panel.cameraStarting")}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="text-xs text-[var(--muted)]">
              {error ?? t("panel.cameraOff")}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              void start();
            }}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)]"
          >
            {t("panel.retakePhoto")}
          </button>
        ) : live ? (
          <>
            <button
              type="button"
              onClick={capture}
              disabled={!ready}
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {ready ? t("panel.takePhoto") : "Menyiapkan…"}
            </button>
            <button
              type="button"
              onClick={stop}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition-colors hover:text-foreground"
            >
              Batal
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-[var(--background)] disabled:opacity-50"
          >
            {starting ? t("panel.openingCamera") : t("panel.openCamera")}
          </button>
        )}
      </div>

      {error && value === null && !live && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
