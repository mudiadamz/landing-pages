import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireFeature } from "@/lib/actions/profiles";

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
    .select("id, full_name, email, role, is_active")
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
  const { userId, active, role } = body as {
    userId: string;
    active?: boolean;
    role?: string;
  };

  if (!userId) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }
  if (userId === user.id) {
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

  return NextResponse.json({ error: "Invalid data" }, { status: 400 });
}
