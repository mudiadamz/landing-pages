/**
 * Where a sign-in is allowed to send someone afterwards.
 *
 * Deliberately dependency-free: this is imported by the proxy (which runs before
 * every guarded request), by Server Actions and by pages, and anything it pulled
 * in would be pulled into all three.
 *
 * Only a path on this site survives. `startsWith("/")` alone — which is what the
 * auth flow used to check in five places — lets two shapes through that leave the
 * site entirely:
 *
 *   * `//evil.example` — a protocol-relative URL. It begins with a slash and
 *     browsers resolve it against the current scheme, so `redirect()` sends the
 *     visitor to another origin. That is an open redirect on the login page, and
 *     a login page is exactly where one is worth having: the link looks like ours
 *     right up to the moment it hands somebody a convincing fake.
 *   * `/\evil.example` — some browsers normalise the backslash to a slash first,
 *     which turns it back into the case above.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
