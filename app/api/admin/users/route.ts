import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireFeature } from "@/lib/actions/profiles";
import { normalizePlan } from "@/lib/plans";

/** Caller identity + access: full admin, and whether they can reach the Users feature. */
async function getCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, hasUsers: false };

  const [isAdmin, hasUsers] = await Promise.all([requireAdmin(), requireFeature("users")]);
  return { user, isAdmin, hasUsers };
}

export async function GET() {
  const { user, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lp_profiles")
    .select(
      "id, full_name, email, role, is_active, exclude_from_stats, email_verified_at, plan, plan_expires_at",
    )
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  const { user, isAdmin, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, active, role, excludeFromStats, plan } = body as {
    userId: string;
    active?: boolean;
    role?: string;
    excludeFromStats?: boolean;
    plan?: string;
  };

  if (!userId) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  // Guarding your own account applies to role and ban only. Excluding yourself
  // from analytics is the common case — it's your own testing traffic — and
  // carries no privilege risk.
  const selfEdit = userId === user.id;
  if (selfEdit && (typeof role === "string" || typeof active === "boolean")) {
    return NextResponse.json({ error: "Tidak bisa mengubah akun sendiri" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Change role — only a full admin may do this (esp. granting admin).
  if (typeof role === "string") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Hanya admin penuh yang bisa mengubah role." }, { status: 403 });
    }
    if (!["admin", "customer", "publisher"].includes(role)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const publisher_status = role === "publisher" ? "approved" : "none";
    const { error } = await admin
      .from("lp_profiles")
      .update({ role, publisher_status })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  /**
   * Put a user on a plan by hand.
   *
   * Stays even though plans are bought with money: a refund, a comped account and
   * a support fix all need a way in that does not involve charging somebody.
   *
   * Granted this way it does NOT expire — `plan_expires_at` is cleared. An admin
   * setting a plan is making a decision, not selling a year, and inventing an end
   * date for it would surprise everyone later.
   */
  if (typeof plan === "string") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Hanya admin penuh yang bisa mengubah paket." }, { status: 403 });
    }
    if (normalizePlan(plan) !== plan) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const { error } = await admin
      .from("lp_profiles")
      .update({ plan, plan_expires_at: null })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Ban / unban. Updates is_active and bans/unbans at the auth level so a banned
  // user's session stops working (getUser fails → middleware sends to /login).
  if (typeof active === "boolean") {
    const { error } = await admin
      .from("lp_profiles")
      .update({ is_active: active })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
    const { error: banError } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (banError) {
      await admin.from("lp_profiles").update({ is_active: !active }).eq("id", userId);
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Exclude this account's traffic from analytics (own testing, staff browsing).
  if (typeof excludeFromStats === "boolean") {
    const { error } = await admin
      .from("lp_profiles")
      .update({ exclude_from_stats: excludeFromStats })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update analytics exclusion" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid data" }, { status: 400 });
}

/**
 * Delete an account for good.
 *
 * Full admin only, and deliberately NOT delegatable through the Users feature:
 * ban is the reversible control a delegate gets, this one is not reversible at
 * all. Same line /panel/roles draws for role and plan changes.
 *
 * What survives, and why:
 *
 *   lp_purchases / lp_plan_orders  kept, with user_id set to NULL by the FK
 *       (migration 20260829000000). Deleting a person is a decision about their
 *       personal data; it is not a refund, and the money was still taken. Sales
 *       totals and the invoice trail must not move because an account went away.
 *   lp_landing_pages  cascades — which is why an owner of products is REFUSED
 *       here instead. Losing a catalogue as a side effect of tidying up a user
 *       list is not something to discover afterwards.
 *   reviews, likes, chat history, sessions  cascade, and should: they are the
 *       person, not the transaction.
 *   publisher-kyc photos  removed explicitly. An ID card and a selfie are the
 *       most sensitive thing this app stores, and Storage has no foreign key to
 *       cascade them.
 */
export async function DELETE(req: Request) {
  const { user, isAdmin } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Hanya admin penuh yang bisa menghapus user." },
      { status: 403 },
    );
  }

  const { userId } = (await req.json()) as { userId?: string };
  if (!userId) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("lp_profiles")
    .select("role, full_name, email, publisher_ktp_path, publisher_selfie_path")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  // Another admin has to be demoted first. Not paranoia about malice — it is one
  // extra deliberate step in front of the account that can undo everything else.
  if (target.role === "admin") {
    return NextResponse.json(
      { error: "Turunkan role-nya dari admin dulu sebelum menghapus." },
      { status: 400 },
    );
  }

  // Products cascade with their owner. Count them and refuse, naming the number,
  // so the admin decides what happens to the catalogue rather than finding out.
  const { count: productCount } = await admin
    .from("lp_landing_pages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (productCount && productCount > 0) {
    return NextResponse.json(
      {
        error:
          `Akun ini masih memiliki ${productCount} produk. Hapus atau pindahkan produknya dulu — ` +
          `menghapus akunnya akan ikut menghapus produk itu beserta filenya.`,
      },
      { status: 409 },
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteUser error:", error);
    return NextResponse.json({ error: "Gagal menghapus user." }, { status: 500 });
  }

  // After the account is gone, not before: if this ran first and the delete then
  // failed, an existing publisher would have lost the documents an admin still
  // needs to review. Best effort — a leftover file is worth logging, not worth
  // resurrecting an account for.
  await removeKycFiles(admin, userId);

  return NextResponse.json({ success: true });
}

async function removeKycFiles(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  try {
    // Uploads are timestamped (see applyAsPublisher), so a re-application leaves
    // older pairs behind — list the folder rather than deleting the two paths
    // the profile happened to point at last.
    const { data: files } = await admin.storage.from("publisher-kyc").list(userId);
    if (!files?.length) return;
    await admin.storage.from("publisher-kyc").remove(files.map((f) => `${userId}/${f.name}`));
  } catch (e) {
    console.error("removeKycFiles error:", e);
  }
}
