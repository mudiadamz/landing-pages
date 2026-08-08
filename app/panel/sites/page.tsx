import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/actions/profiles";
import { getSites, isVercelConfigured } from "@/lib/actions/sites";
import { isCanonicalRequest, canonicalOrigin } from "@/lib/site-resolve";
import { templatePickerOptions } from "@/lib/templates/registry";
import { paletteOptions } from "@/lib/palette";
import { SitesManager } from "./sites-manager";

export const metadata = { title: "Domain" };

export default async function SitesPage() {
  if (!(await requireAdmin())) redirect("/panel");

  // Belt and braces: app/panel/layout.tsx already sends admin routes on a niche
  // domain to the canonical origin, so this normally never fires. Kept because this
  // screen in particular could otherwise be used from a niche domain to rewrite the
  // canonical domain's own host — a guard worth having twice.
  if (!(await isCanonicalRequest())) redirect(`${canonicalOrigin()}/panel/sites`);

  const [sites, vercelAutomated] = await Promise.all([getSites(), isVercelConfigured()]);

  // Labels only. This screen names a site's template and palette in its summary line
  // but no longer lets you change them, so it has no use for the full picker options.
  const templateLabels = Object.fromEntries(
    templatePickerOptions().map((t) => [t.key, t.label]),
  );
  const paletteLabels = Object.fromEntries(paletteOptions().map((p) => [p.key, p.label]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Domain</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Hostname, status Vercel, dan aktif/nonaktif. Nama, logo, template, palet, dan
          niche ada di{" "}
          <Link href="/panel/branding" className="text-[var(--primary)] hover:underline">
            Identitas situs
          </Link>
          .
        </p>
      </div>

      <SitesManager
        sites={sites}
        canonicalHost={canonicalOrigin().replace(/^https?:\/\//, "")}
        // Public anyway (it ships to the browser as a NEXT_PUBLIC var) and needed
        // verbatim: it is the one redirect URI Google is configured with.
        supabaseProjectUrl={(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}
        vercelAutomated={vercelAutomated}
        templateLabels={templateLabels}
        paletteLabels={paletteLabels}
      />
    </div>
  );
}
