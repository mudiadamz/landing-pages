import type { Metadata } from "next";
import { NotFoundBody } from "@/components/not-found-body";

/**
 * The body the proxy rewrites to when it knows a record is missing.
 *
 * A rewrite can carry a status; a page cannot set one. Rendering the 404 through
 * a real route is what lets the response be an actual 404 instead of the 404
 * body under a 200 that every dynamic route here was serving.
 *
 * noindex, because this URL is an implementation detail — the address the
 * visitor typed is the one that should be reported missing.
 */
export const metadata: Metadata = {
  title: "404 — Halaman tidak ditemukan",
  robots: { index: false, follow: false },
};

export default function NotFoundPageRoute() {
  return <NotFoundBody />;
}
