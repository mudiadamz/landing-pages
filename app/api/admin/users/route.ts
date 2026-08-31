import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireFeature, requireSiteAdmin } from "@/lib/actions/profiles";
import { editingSite } from "@/lib/site-resolve";
import { normalizeSiteRole } from "@/lib/site-membership";
import { normalizeRole } from "@/lib/profile-utils";
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

const PROFILE_COLUMNS =
  "id, full_name, email, role, is_active, exclude_from_stats, email_verified_at, plan, plan_expires_at";

/**
 * Daftar user — anggota situs yang sedang dilihat, bukan seluruh database.
 *
 * `?scope=all` mengembalikan semuanya, dan hanya untuk platform admin: itu satu-
 * satunya orang yang punya urusan lintas situs. Tanpa parameter itu, seorang
 * platform admin pun melihat daftar yang sudah dipersempit — kalau tidak,
 * "user situs ini" akan berarti dua hal berbeda tergantung siapa yang bertanya.
 */
export async function GET(req: Request) {
  const { user, isAdmin, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const wantsAll = new URL(req.url).searchParams.get("scope") === "all";

  if (wantsAll && isAdmin) {
    const { data, error } = await admin
      .from("lp_profiles")
      .select(PROFILE_COLUMNS)
      .order("role", { ascending: true })
      .order("full_name", { ascending: true });
    if (error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    // site_role null = "tidak relevan di tampilan lintas situs", bukan "bukan anggota".
    return NextResponse.json(
      (data ?? []).map((r) => ({ ...r, role: normalizeRole(r.role), site_role: null })),
    );
  }

  const site = await editingSite();
  const { data: members, error: memberErr } = await admin
    .from("lp_site_members")
    .select("user_id, role")
    .eq("site_id", site.id);
  if (memberErr) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  if (!members?.length) return NextResponse.json([]);

  const roleById = new Map(members.map((m) => [m.user_id as string, normalizeSiteRole(m.role)]));
  const { data, error } = await admin
    .from("lp_profiles")
    .select(PROFILE_COLUMNS)
    .in("id", [...roleById.keys()])
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });
  if (error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });

  /**
   * Role dinormalkan DI SINI, bukan di komponen.
   *
   * Selama peralihan istilah sebagian baris masih berisi nilai lama, dan sebuah
   * dropdown yang menerima nilai yang tidak ada di daftar option-nya tidak error
   * — ia hanya menampilkan role yang salah, diam-diam. API adalah batasnya, jadi
   * di sinilah kosakata disatukan.
   */
  return NextResponse.json(
    (data ?? []).map((r) => ({
      ...r,
      role: normalizeRole(r.role),
      site_role: roleById.get(r.id) ?? null,
    })),
  );
}

/**
 * Admin situs tidak boleh menyentuh platform admin.
 *
 * Tanpa ini, admin situs bisa menurunkan atau mengeluarkan orang yang
 * mengangkatnya — dan platform admin adalah akun yang bisa membatalkan semua
 * keputusan lain, jadi ia harus kebal terhadap tingkat di bawahnya.
 */
async function guardPlatformAdminTarget(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  actorIsPlatformAdmin: boolean,
): Promise<NextResponse | null> {
  if (actorIsPlatformAdmin) return null;
  const { data } = await admin.from("lp_profiles").select("role").eq("id", userId).maybeSingle();
  if (normalizeRole(data?.role) === "company") {
    return NextResponse.json({ error: "Tidak bisa mengubah Company." }, { status: 403 });
  }
  return null;
}

/**
 * Undang akun yang SUDAH ADA ke situs ini.
 *
 * Sengaja tidak membuat akun baru: membuat akun berarti mengarang password atau
 * mengirim undangan email, dan keduanya urusan yang lebih besar daripada
 * "tambahkan orang ini ke situs saya". Email yang tidak dikenal ditolak dengan
 * pesan yang mengatakan begitu, bukan diam-diam tidak melakukan apa-apa.
 */
async function addMemberByEmail(
  email: string,
  siteRole: string,
  actorId: string,
): Promise<NextResponse> {
  const site = await editingSite();
  if (!(await requireSiteAdmin(site.id))) {
    return NextResponse.json({ error: "Bukan Agent situs ini." }, { status: 403 });
  }
  if (normalizeSiteRole(siteRole) !== siteRole) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  const clean = email.trim().toLowerCase();
  if (!clean) return NextResponse.json({ error: "Email wajib diisi." }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("lp_profiles")
    .select("id")
    .ilike("email", clean)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Belum ada akun dengan email itu. Minta dia mendaftar dulu." },
      { status: 404 },
    );
  }

  const { error } = await admin
    .from("lp_site_members")
    .upsert(
      { site_id: site.id, user_id: profile.id, role: siteRole, invited_by: actorId },
      { onConflict: "site_id,user_id" },
    );
  if (error) {
    console.error("addMemberByEmail error:", error);
    return NextResponse.json({ error: "Gagal menambahkan ke situs." }, { status: 500 });
  }
  return NextResponse.json({ success: true, userId: profile.id });
}

export async function PATCH(req: Request) {
  const { user, isAdmin, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, active, role, excludeFromStats, plan, siteRole, email } = body as {
    userId?: string;
    active?: boolean;
    role?: string;
    excludeFromStats?: boolean;
    plan?: string;
    /** Role DI SITUS yang sedang dilihat. Beda dari `role`, yang platform. */
    siteRole?: string;
    /** Undang akun yang sudah ada ke situs ini, dipasangkan dengan siteRole. */
    email?: string;
  };

  // Mengundang lewat email: satu-satunya operasi yang belum punya userId.
  if (typeof siteRole === "string" && !userId && typeof email === "string") {
    return addMemberByEmail(email, siteRole, user.id);
  }

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

  /**
   * Ubah role seseorang DI SITUS ini. Boleh dilakukan admin situs.
   *
   * Ini bukan `role` di bawah: yang ini keanggotaan, yang itu tingkat platform.
   * Mencampurnya berarti admin sebuah situs bisa mengangkat dirinya jadi
   * platform admin lewat layar yang sama.
   */
  if (typeof siteRole === "string") {
    const site = await editingSite();
    if (!(await requireSiteAdmin(site.id))) {
      return NextResponse.json({ error: "Bukan Agent situs ini." }, { status: 403 });
    }
    if (normalizeSiteRole(siteRole) !== siteRole) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    if (selfEdit) {
      // Menurunkan diri sendiri berarti mengunci diri di luar situs yang sedang
      // Anda kelola, dan tidak ada tombol untuk membatalkannya.
      return NextResponse.json({ error: "Tidak bisa mengubah role sendiri." }, { status: 400 });
    }
    const guard = await guardPlatformAdminTarget(admin, userId, isAdmin);
    if (guard) return guard;

    const { error } = await admin
      .from("lp_site_members")
      .upsert(
        { site_id: site.id, user_id: userId, role: siteRole, invited_by: user.id },
        { onConflict: "site_id,user_id" },
      );
    if (error) {
      console.error("set site role error:", error);
      return NextResponse.json({ error: "Gagal mengubah role di situs ini." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Change role — only a full admin may do this (esp. granting admin).
  if (typeof role === "string") {
    if (!isAdmin) {
      return NextResponse.json({ error: "Hanya Company yang bisa mengubah role." }, { status: 403 });
    }
    if (!["company", "customer", "publisher"].includes(role)) {
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
      return NextResponse.json({ error: "Hanya Company yang bisa mengubah paket." }, { status: 403 });
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
    // Ban itu tingkat PLATFORM — orangnya tidak bisa masuk ke domain mana pun.
    // Admin situs yang ingin mengeluarkan seseorang memakai DELETE fromSite.
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Hanya Company yang bisa ban akun. Untuk mengeluarkan dari situs ini, pakai tombol keluarkan." },
        { status: 403 },
      );
    }
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

  const { userId, fromSite } = (await req.json()) as { userId?: string; fromSite?: boolean };
  if (!userId) return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri." }, { status: 400 });
  }

  /**
   * Keluarkan dari situs ini — BUKAN hapus akun.
   *
   * Dua hal yang gampang tertukar dan hasilnya jauh berbeda: yang satu mencabut
   * akses ke satu storefront, yang satu menghapus orangnya dari seluruh sistem.
   * Yang ini boleh dilakukan admin situs; yang di bawah tidak.
   */
  if (fromSite) {
    const site = await editingSite();
    if (!(await requireSiteAdmin(site.id))) {
      return NextResponse.json({ error: "Bukan Agent situs ini." }, { status: 403 });
    }
    const adminClient = createAdminClient();
    const guard = await guardPlatformAdminTarget(adminClient, userId, isAdmin);
    if (guard) return guard;
    const { error } = await adminClient
      .from("lp_site_members")
      .delete()
      .eq("site_id", site.id)
      .eq("user_id", userId);
    if (error) {
      console.error("remove member error:", error);
      return NextResponse.json({ error: "Gagal mengeluarkan dari situs." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // Hapus akun: platform admin saja. Gate-nya di sini, SESUDAH cabang fromSite
  // di atas — kalau di pintu masuk, admin situs tidak akan bisa mengeluarkan
  // siapa pun dari situsnya sendiri.
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Hanya Company yang bisa menghapus user." },
      { status: 403 },
    );
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
  if (normalizeRole(target.role) === "company") {
    return NextResponse.json(
      { error: "Turunkan role-nya dari Company dulu sebelum menghapus." },
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
