import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";

/**
 * Who the browser is signed in as. The session cookie is httpOnly, so client
 * code (the upload helpers) asks here instead of reading it. Only the id and
 * email — what those callers need to build a `<uid>/…` path.
 */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json(
    { user: user ? { id: user.id, email: user.email } : null },
    { headers: { "cache-control": "private, no-store" } },
  );
}
