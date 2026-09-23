import { describe, expect, it } from "vitest";
import { makeUser, sql } from "./sql";

/**
 * The test that would have caught 20260903010000.
 *
 * That migration dropped lp_profiles.role while lp_handle_new_user() still
 * inserted into it, so every insert into auth.users failed and nobody could
 * sign up — email or Google. 131 pure tests stayed green throughout.
 */
describe("signup → lp_handle_new_user", () => {
  it("membuat tepat satu baris profil untuk user baru", async () => {
    const id = await makeUser({ fullName: "Budi" });
    const { rows } = await sql("select full_name, is_platform from public.lp_profiles where id = $1", [id]);
    expect(rows).toEqual([{ full_name: "Budi", is_platform: false }]);
  });

  it("jenis akun datang dari default kolom, bukan dari trigger", async () => {
    // The trigger must not name the account type: that is exactly how it went
    // stale the last time the vocabulary changed.
    const { rows } = await sql<{ def: string }>(
      "select pg_get_functiondef('public.lp_handle_new_user'::regproc) as def",
    );
    expect(rows[0].def).not.toMatch(/account_type|\brole\b/);
  });

  it("daftar lewat email: alamatnya BELUM terbukti", async () => {
    const id = await makeUser({ provider: "email" });
    const { rows } = await sql("select email_verified_at from public.lp_profiles where id = $1", [id]);
    expect(rows[0].email_verified_at).toBeNull();
  });

  it("daftar lewat Google: alamatnya sudah dibuktikan Google", async () => {
    const id = await makeUser({ provider: "google" });
    const { rows } = await sql("select email_verified_at from public.lp_profiles where id = $1", [id]);
    expect(rows[0].email_verified_at).not.toBeNull();
  });

  it("fungsi SECURITY DEFINER-nya mematok search_path", async () => {
    const { rows } = await sql<{ cfg: string[] | null }>(
      "select proconfig as cfg from pg_proc where oid = 'public.lp_handle_new_user'::regproc",
    );
    expect(rows[0].cfg ?? []).toContain("search_path=public");
  });
});
