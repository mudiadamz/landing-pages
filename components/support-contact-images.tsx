import { SUPPORT_CONTACT } from "@/lib/constants";

const LABELS = {
  email: "Email",
  phone: "Telepon",
  address: "Alamat",
} as const;

/**
 * Support contact block. Renders whatever of SUPPORT_CONTACT (lib/constants.ts)
 * is filled in — nothing by default, so a fresh/rebranded deployment shows no
 * placeholder contact. Set your business email/phone/address in lib/constants.ts.
 * (Named for its former image-based form; now plain text.)
 */
export async function SupportContactImages() {
  const entries = (Object.keys(LABELS) as (keyof typeof LABELS)[])
    .map((key) => [key, SUPPORT_CONTACT[key]] as const)
    .filter(([, value]) => !!value);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">{LABELS[key]}</span>
          <span className="text-sm text-[var(--muted)]">{value}</span>
        </div>
      ))}
    </div>
  );
}
