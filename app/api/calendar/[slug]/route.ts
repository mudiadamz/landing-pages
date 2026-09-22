import { NextResponse } from "next/server";
import { getLandingPageForCheckout } from "@/lib/actions/landing-pages";
import { SITE_URL } from "@/lib/seo";

/**
 * Serves a standard iCalendar (.ics) file for a product whose buy-now action is
 * set to "calendar". A single link works everywhere: iOS Safari opens the
 * "Add to Calendar" sheet, macOS/Windows hand the file to the default calendar
 * app, and Android downloads it for Google Calendar to import.
 *
 * Event times are stored as floating local datetime strings (e.g.
 * "2026-08-01T14:00") and emitted as floating DTSTART/DTEND — the event shows at
 * that wall-clock time in the attendee's calendar, no timezone math involved.
 */

/** Escape a text value per RFC 5545 (backslash, comma, semicolon, newlines). */
function escapeICS(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** "2026-08-01T14:00" | "...:00" → "20260801T140000" (floating, no Z). */
function toFloating(local: string): string | null {
  const m = local
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}${m[6] ?? "00"}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Current UTC timestamp for DTSTAMP, e.g. "20260723T101500Z". */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Local (floating) formatting of a Date, e.g. "20260801T150000". */
function floatingFromDate(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** Fold content lines at 75 octets per RFC 5545 (continuation = CRLF + space). */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 74) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest.length) parts.push(" " + rest);
  return parts.join("\r\n");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = await getLandingPageForCheckout(slug);

  if (!page || page.cta_action !== "calendar" || !page.event_start) {
    return new NextResponse("Not found", { status: 404 });
  }

  const start = toFloating(page.event_start);
  if (!start) return new NextResponse("Invalid event start", { status: 400 });

  // End time: use the explicit value, else default to one hour after the start.
  let end = page.event_end ? toFloating(page.event_end) : null;
  if (!end) {
    const d = new Date(page.event_start);
    if (!Number.isNaN(d.getTime())) {
      d.setHours(d.getHours() + 1);
      end = floatingFromDate(d);
    }
  }

  const title = escapeICS((page.event_title?.trim() || page.title).slice(0, 200));
  const description = page.event_description?.trim()
    ? escapeICS(page.event_description.trim())
    : null;
  const location = page.event_location?.trim()
    ? escapeICS(page.event_location.trim())
    : null;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Storefront//Landing Pages//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:lp-${slug}-${start}@localhost`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${start}`,
    end ? `DTEND:${end}` : null,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description}` : null,
    location ? `LOCATION:${location}` : null,
    `URL:${SITE_URL}/checkout/${slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter((l): l is string => l !== null)
    .map(fold);

  const body = lines.join("\r\n") + "\r\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "public, max-age=60",
    },
  });
}
