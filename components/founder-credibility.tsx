import Link from "next/link";
import { getSiteContent } from "@/lib/actions/site-settings";

type Props = {
  /** When provided (>0), shows "N template diterbitkan" as concrete proof. */
  templateCount?: number;
  className?: string;
};

/** First letter of the name, for the fallback avatar when no photo is set. */
function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "A";
}

/**
 * Compact maker-proof strip. With low review volume, the founder is the
 * strongest trust substitute — real name, real photo, direct contact.
 * All copy/photo is editable from /panel/content (SiteContent.founder).
 */
export async function FounderCredibility({ templateCount, className = "" }: Props) {
  const { founder } = await getSiteContent();
  if (!founder.enabled) return null;

  const publishedLabel =
    templateCount && templateCount > 0 ? `${templateCount} template diterbitkan · ` : "";

  return (
    <div
      className={`flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 ${className}`}
    >
      <div className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden border border-[var(--border)] bg-[var(--background)]">
        {founder.photoUrl ? (
          // Plain <img>: photoUrl may be an arbitrary storage URL, so avoid
          // next/image's remote-domain allowlist. 48px, so weight is trivial.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={founder.photoUrl}
            alt={founder.name}
            width={48}
            height={48}
            className="object-cover w-full h-full"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--muted)]">
            {initial(founder.name)}
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{founder.name}</p>
        {founder.role && <p className="text-xs text-[var(--muted)]">{founder.role}</p>}
        <p className="mt-1 text-xs text-[var(--muted)] leading-relaxed">
          {publishedLabel}
          {founder.bio}
          {founder.contactLabel && founder.contactHref && (
            <>
              {" "}
              <Link
                href={founder.contactHref}
                className="text-[var(--primary)] hover:underline font-medium"
              >
                {founder.contactLabel}
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </div>
  );
}
