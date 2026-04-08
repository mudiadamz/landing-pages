"use server";

import { unstable_cache, revalidateTag } from "next/cache";
import { createClient as createSupabaseJS } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "./profiles";

const CUSTOM_JS_KEY = "custom_js";

export const getCustomJs = unstable_cache(
  async (): Promise<string> => {
    try {
      const supabase = createSupabaseJS(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", CUSTOM_JS_KEY)
        .single();
      return (data?.value as string) ?? "";
    } catch {
      return "";
    }
  },
  ["custom-js"],
  { revalidate: 120 },
);

export async function updateCustomJs(script: string): Promise<{ ok: boolean; error?: string }> {
  const isAdmin = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Akses ditolak." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: CUSTOM_JS_KEY, value: script.trim(), updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    console.error("updateCustomJs error:", error);
    return { ok: false, error: "Gagal menyimpan." };
  }
  return { ok: true };
}
