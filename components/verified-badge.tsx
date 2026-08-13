import { t } from "@/lib/i18n";

/**
 * The blue rosette-and-tick that follows a name.
 *
 * Its own colour, not a palette token: the mark is only legible as "verified"
 * because it is that specific blue, and a storefront on a green palette would
 * turn it into a decoration nobody recognises. The tick is punched out in white
 * rather than drawn in the page's foreground, so it survives dark mode too.
 *
 * Meaning is the storefront's own claim about its owner, set in /panel/content —
 * it asserts nothing about any third party's verification programme.
 */
export function VerifiedBadge({
  className = "h-5 w-5",
  label = t("home.verified"),
}: {
  className?: string;
  label?: string;
}) {
  return (
    <svg
      className={`inline-block shrink-0 align-[-0.15em] ${className}`}
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path
        fill="#0095F6"
        d="M12 1.5l2.31 1.79 2.9-.29 1.16 2.68 2.68 1.16-.29 2.9L22.5 12l-1.74 2.26.29 2.9-2.68 1.16-1.16 2.68-2.9-.29L12 22.5l-2.31-1.79-2.9.29-1.16-2.68-2.68-1.16.29-2.9L1.5 12l1.74-2.26-.29-2.9 2.68-1.16L6.79 3l2.9.29z"
      />
      <path fill="#fff" d="M10.83 15.6l-3.2-3.2 1.27-1.27 1.93 1.93 4.47-4.47 1.27 1.28z" />
    </svg>
  );
}
