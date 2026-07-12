import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeFeatures } from "@/lib/features";

/** Caller's role + whether they can access the Users feature (admin or delegated). */
async function getCaller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, isAdmin: false, hasUsers: false };

  const { data: profile } = await supabase
    .from("lp_profiles")
    .select("role, permissions")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const hasUsers = isAdmin || normalizeFeatures(profile?.permissions).includes("users");
  return { user, isAdmin, hasUsers };
}

export async function GET() {
  const { user, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lp_profiles")
    .select("id, full_name, email, role, is_active, permissions")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  return NextResponse.json(
    (data ?? []).map((u) => ({ ...u, permissions: normalizeFeatures(u.permissions) })),
  );
}

export async function PATCH(req: Request) {
  const { user, isAdmin, hasUsers } = await getCaller();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasUsers) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { userId, active, permissions } = body as {
    userId: string;
    active?: boolean;
    permissions?: string[];
  };

  if (!userId) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json({ error: "Tidak bisa mengubah akun sendiri" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Edit feature access — only a full admin may delegate (prevents a delegate
  // with the "users" feature from escalating their own / others' access).
  if (Array.isArray(permissions)) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Hanya admin penuh yang bisa mengatur akses." }, { status: 403 });
    }
    const clean = normalizeFeatures(permissions);
    const { error } = await admin
      .from("lp_profiles")
      .update({ permissions: clean })
      .eq("id", userId);
    if (error) {
      return NextResponse.json({ error: "Failed to update access" }, { status: 500 });
    }
    return NextResponse.json({ success: true, permissions: clean });
  }

  // Toggle active / non-active. Also ban/unban at the auth level so a
  // deactivated user's session actually stops working (getUser fails → treated
  // as logged out by middleware).
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
      // Roll back the flag so DB and auth stay consistent.
      await admin.from("lp_profiles").update({ is_active: !active }).eq("id", userId);
      return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid data" }, { status: 400 });
}
