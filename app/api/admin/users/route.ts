import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { createAdminClient } from "@/lib/db/admin";
import { requireAdmin, requireFeature, requireSiteAdmin, requirePlatform } from "@/lib/actions/profiles";
import { editingSite } from "@/lib/site-resolve";
import { normalizeBusinessRole, type BusinessRole } from "@/lib/profile-utils";
import { normalizePlan } from "@/lib/plans";
import { deleteUser, setBanned } from "@/lib/backend/auth";

/** Caller identity + access: full admin, and whether they can reach the Users feature. */
async function getCaller() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { user: null, isAdmin: false, hasUsers: false };

  const [isAdmin, hasUsers, isPlatform] = await Promise.all([
    requireAdmin(),
    requireFeature("users"),
    requirePlatform(),
  ]);
  return { user, isAdmin, hasUsers, isPlatform };
}

const PROFILE_COLUMNS =
  "id, full_name, email, is_platform, is_active, exclude_from_stats, email_verified_at, plan, plan_expires_at";

/**
 * Business membership for a batch of people, as `{userId: role}`.
 *
 * Its own query rather than a join: since Fase 5 the standing lives in two
 * tables on purpose (is_platform on the profile, role per business), and
 * flattening them back into one row in SQL is how the old account_type got
 * invented in the first place.
 */
async function rolesByUser(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[],
): Promise<Map<string, BusinessRole>> {
  const out = new Map<string, BusinessRole>();
  if (!ids.length) return out;
  const { data } = await admin
    .from("lp_business_members")
    .select("user_id, role")
    .in("user_id", ids);
  for (const r of data ?? []) {
    const role = normalizeBusinessRole(r.role);
    if (role) out.set(r.user_id as string, role);
  }
  return out;
}

/**
 * Daftar user — anggota situs yang sedang dilihat, bukan seluruh database.
 *
 * `?scope=all` mengembalikan semuanya, dan hanya untuk platform admin: itu satu-
 * satunya orang yang punya urusan lintas situs. Tanpa parameter itu, seorang
 * platform admin pun melihat daftar yang sudah dipersempit — kalau tidak,
 * "user situs ini" akan berarti dua hal berbeda tergantung siapa yang bertanya.
 */
export async function GET(req: Request) {
  const { user, hasUsers, isPlatform } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const wantsAll = new URL(req.url).searchParams.get("scope") === "all";

  // The cross-business "all users" view is the Platform's alone (multi-business,
  // docs/plans/multi-business-saas.md). A business admin who asks for scope=all
  // falls through to the site-scoped list of the business's own storefront —
  // per-site membership already keeps one business's users out of another's.
  if (wantsAll && isPlatform) {
    const { data, error } = await admin
      .from("lp_profiles")
      .select(PROFILE_COLUMNS)
      .order("is_platform", { ascending: false })
      .order("full_name", { ascending: true });
    if (error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    const roles = await rolesByUser(admin, (data ?? []).map((r) => r.id as string));
    // site_role null = "tidak relevan di tampilan lintas situs", bukan "bukan anggota".
    return NextResponse.json(
      (data ?? []).map((r) => ({
        ...r,
        business_role: roles.get(r.id as string) ?? null,
        is_agent: null,
        is_publisher: null,
      })),
    );
  }

  const site = await editingSite();
  // No resolved site (empty database, or a fallback with no id) means there are
  // no members to list — an empty result, never a query against site_id = '',
  // which Postgres rejects as an invalid uuid and would surface as a 500 that
  // the table then mislabels as "no users".
  if (!site.id) return NextResponse.json([]);
  // Dua tabel, karena keduanya menjawab hal berbeda:
  // keanggotaan = "customer di sini", keagenan = "yang mengelola sini".
  const [{ data: members, error: memberErr }, { data: agents }] = await Promise.all([
    admin.from("lp_site_members").select("user_id, is_publisher").eq("site_id", site.id),
    admin.from("lp_site_agents").select("user_id").eq("site_id", site.id),
  ]);
  if (memberErr) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });

  const publisherById = new Map(
    (members ?? []).map((m) => [m.user_id as string, !!m.is_publisher]),
  );
  const agentIds = new Set((agents ?? []).map((a) => a.user_id as string));
  const ids = [...new Set([...publisherById.keys(), ...agentIds])];
  if (!ids.length) return NextResponse.json([]);
  const { data, error } = await admin
    .from("lp_profiles")
    .select(PROFILE_COLUMNS)
    .in("id", ids)
    .order("is_platform", { ascending: false })
    .order("full_name", { ascending: true });
  if (error) return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  const roles = await rolesByUser(admin, (data ?? []).map((r) => r.id as string));

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
      business_role: roles.get(r.id as string) ?? null,
      is_agent: agentIds.has(r.id),
      is_publisher: publisherById.get(r.id) ?? false,
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
  const { data } = await admin.from("lp_profiles").select("is_platform").eq("id", userId).maybeSingle();
  if (data?.is_platform) {
    return NextResponse.json({ error: "Tidak bisa mengubah akun Platform." }, { status: 403 });
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
async function addMemberByEmail(email: string, actorId: string): Promise<NextResponse> {
  const site = await editingSite();
  if (!(await requireSiteAdmin(site.id))) {
    return NextResponse.json({ error: "Bukan Agent situs ini." }, { status: 403 });
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
      { site_id: site.id, user_id: profile.id, invited_by: actorId },
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
  const { userId, active, businessRole, isPlatform, excludeFromStats, plan, isAgent, isPublisher, email } =
    body as {
      userId?: string;
      active?: boolean;
      /**
       * Peran di business yang memiliki situs yang sedang dibuka, atau "" untuk
       * mengeluarkan dia dari business itu. Platform saja yang boleh mengubahnya.
       */
      businessRole?: string;
      /** Jadikan / cabut operator Platform. Platform saja. */
      isPlatform?: boolean;
      excludeFromStats?: boolean;
      plan?: string;
      /** Mengelola situs yang sedang dilihat. */
      isAgent?: boolean;
      /** Boleh menjual di situs yang sedang dilihat. */
      isPublisher?: boolean;
      /** Undang akun yang sudah ada jadi customer situs ini. */
      email?: string;
    };

  // Mengundang lewat email: satu-satunya operasi yang belum punya userId.
  if (!userId && typeof email === "string") {
    return addMemberByEmail(email, user.id);
  }

  if (!userId) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  // Guarding your own account applies to role and ban only. Excluding yourself
  // from analytics is the common case — it's your own testing traffic — and
  // carries no privilege risk.
  const selfEdit = userId === user.id;
  if (selfEdit && (typeof businessRole === "string" || typeof isPlatform === "boolean" || typeof active === "boolean")) {
    return NextResponse.json({ error: "Tidak bisa mengubah akun sendiri" }, { status: 400 });
  }

  const admin = createAdminClient();

  /**
   * Dua saklar per-situs, menggantikan satu "role situs".
   *
   *   isAgent      → baris di lp_site_agents  (mengelola situs ini)
   *   isPublisher  → flag di lp_site_members  (boleh menjual di situs ini)
   *
   * Sengaja terpisah dari `businessRole`/`isPlatform` di bawah: yang ini per
   * situs, yang itu kedudukan di business / di platform. Satu kontrol untuk
   * semuanya berarti pengelola satu situs bisa mengangkat dirinya jadi Platform
   * lewat layar yang sama.
   */
  if (typeof isAgent === "boolean" || typeof isPublisher === "boolean") {
    const site = await editingSite();
    if (!(await requireSiteAdmin(site.id))) {
      return NextResponse.json({ error: "Bukan Agent situs ini." }, { status: 403 });
    }
    if (selfEdit) {
      // Menurunkan diri sendiri berarti mengunci diri di luar situs yang sedang
      // Anda kelola, dan tidak ada tombol untuk membatalkannya.
      return NextResponse.json({ error: "Tidak bisa mengubah diri sendiri." }, { status: 400 });
    }
    const guard = await guardPlatformAdminTarget(admin, userId, isAdmin);
    if (guard) return guard;

    if (typeof isAgent === "boolean") {
      const { error } = isAgent
        ? await admin
            .from("lp_site_agents")
            .upsert({ site_id: site.id, user_id: userId, invited_by: user.id }, {
              onConflict: "site_id,user_id",
              ignoreDuplicates: true,
            })
        : await admin
            .from("lp_site_agents")
            .delete()
            .eq("site_id", site.id)
            .eq("user_id", userId);
      if (error) {
        console.error("set agent error:", error);
        return NextResponse.json({ error: "Gagal mengubah status Agent." }, { status: 500 });
      }
      // Jadi Agent tidak menghapus keanggotaannya: dia tetap boleh membeli di
      // situs yang dia kelola, dan pembeliannya tetap tercatat sebagai miliknya.
      if (isAgent) {
        await admin
          .from("lp_site_members")
          .upsert({ site_id: site.id, user_id: userId, invited_by: user.id }, {
            onConflict: "site_id,user_id",
            ignoreDuplicates: true,
          });
      }
    }

    if (typeof isPublisher === "boolean") {
      const { error } = await admin
        .from("lp_site_members")
        .upsert(
          {
            site_id: site.id,
            user_id: userId,
            is_publisher: isPublisher,
            // Disetujui lewat tombol ini berarti disetujui — statusnya ikut,
            // supaya layar pengajuan tidak menampilkan "menunggu" untuk orang
            // yang sudah boleh berjualan.
            publisher_status: isPublisher ? "approved" : "none",
            publisher_reviewed_at: new Date().toISOString(),
            publisher_reviewed_by: user.id,
          },
          { onConflict: "site_id,user_id" },
        );
      if (error) {
        console.error("set publisher error:", error);
        return NextResponse.json({ error: "Gagal mengubah izin jual." }, { status: 500 });
      }
    }
    return NextResponse.json({ success: true });
  }

  /**
   * Peran di sebuah BUSINESS — Platform saja (Fase 5, menggantikan accountType).
   *
   * Business-nya diambil dari situs yang sedang dibuka panel, bukan dari body:
   * "jadikan dia admin" selalu berarti "di business yang sedang saya lihat", dan
   * menerima business_id dari klien akan membuat layar ini bisa menyusupkan orang
   * ke business orang lain. `""` = keluarkan dari business itu.
   */
  if (typeof businessRole === "string") {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Hanya Platform yang bisa mengubah peran business." },
        { status: 403 },
      );
    }
    const site = await editingSite();
    if (!site.business_id) {
      return NextResponse.json(
        { error: "Situs ini belum terhubung ke business mana pun." },
        { status: 400 },
      );
    }
    if (businessRole === "") {
      const { error } = await admin
        .from("lp_business_members")
        .delete()
        .eq("business_id", site.business_id)
        .eq("user_id", userId);
      if (error) {
        console.error("remove business member error:", error);
        return NextResponse.json({ error: "Gagal mengubah peran." }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }
    if (!["owner", "admin", "staff"].includes(businessRole)) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
    const { error } = await admin
      .from("lp_business_members")
      .upsert(
        { business_id: site.business_id, user_id: userId, role: businessRole },
        { onConflict: "business_id,user_id" },
      );
    if (error) {
      console.error("set business role error:", error);
      return NextResponse.json({ error: "Gagal mengubah peran." }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  /**
   * Make somebody a Platform operator, or stop being one.
   *
   * The most dangerous switch in the panel: a Platform account reaches every
   * business and can undo every other decision. Platform-only, never delegated,
   * and never applicable to yourself (guarded above with ban and role).
   */
  if (typeof isPlatform === "boolean") {
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Hanya Platform yang bisa mengangkat operator Platform." },
        { status: 403 },
      );
    }
    const { error } = await admin
      .from("lp_profiles")
      .update({ is_platform: isPlatform })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update platform flag" }, { status: 500 });
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
      return NextResponse.json({ error: "Hanya Platform yang bisa mengubah paket." }, { status: 403 });
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
  // user's sessions stop working (revoked → proxy sends to /login).
  if (typeof active === "boolean") {
    // Ban itu tingkat PLATFORM — orangnya tidak bisa masuk ke domain mana pun.
    // Admin situs yang ingin mengeluarkan seseorang memakai DELETE fromSite.
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Hanya Platform yang bisa ban akun. Untuk mengeluarkan dari situs ini, pakai tombol keluarkan." },
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
    try {
      // Also ends every session the user has — the ban bites on their next click.
      await setBanned(userId, !active);
    } catch (banError) {
      console.error("setBanned error:", banError);
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
      { error: "Hanya Platform yang bisa menghapus user." },
      { status: 403 },
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("lp_profiles")
    .select("is_platform, full_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 });

  // Another operator has to be demoted first. Not paranoia about malice — it is
  // one extra deliberate step in front of the account that can undo everything else.
  if (target.is_platform) {
    return NextResponse.json(
      { error: "Cabut dulu status Platform-nya sebelum menghapus." },
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

  try {
    await deleteUser(userId);
  } catch (error) {
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
