import { BrandMark } from "@/components/brand-mark";
import { brandInitials, type SiteBrand } from "@/lib/site-brand";

/**
 * The brand block in a storefront's header.
 *
 * Three states, in order of what the domain actually has:
 *   logo uploaded  the image alone — a wordmark already contains the name, and
 *                  printing it again beside the image reads as a mistake
 *   icon only      the square mark plus the site name as text
 *   neither        the built-in Storefront mark plus the site name
 *
 * A plain <img>, not next/image, on purpose: a logo may be an SVG, and the image
 * optimiser refuses SVG unless dangerouslyAllowSVG is turned on globally — which
 * would apply to every remote image on the site, product thumbnails included. The
 * file is capped at 300 KB at upload, so there is nothing to optimise anyway.
 *
 * The height is fixed and the width is auto, so a wide wordmark and a square mark
 * both sit correctly in the header row. `width`/`height` attributes are set from
 * the same box to give the browser an aspect ratio before the bytes land; the
 * intrinsic size then corrects it. Without them a logo pops the row on load.
 */
export function SiteLogo({
  brand,
  className = "",
  imgClassName = "h-7 w-auto max-w-[160px] sm:h-8 sm:max-w-[200px]",
  markClassName = "h-6 w-6 sm:h-7 sm:w-7",
  nameClassName = "",
}: {
  brand: SiteBrand;
  className?: string;
  imgClassName?: string;
  markClassName?: string;
  nameClassName?: string;
}) {
  if (brand.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logoUrl}
        alt={brand.name}
        width={200}
        height={32}
        className={`${imgClassName} object-contain ${className}`}
      />
    );
  }

  return (
    <span className={`flex items-center gap-2 ${className}`}>
      {brand.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.iconUrl}
          alt=""
          width={32}
          height={32}
          className={`${markClassName} shrink-0 rounded-md object-cover`}
        />
      ) : (
        <BrandMark className={markClassName} />
      )}
      <span className={nameClassName}>{brand.name}</span>
    </span>
  );
}

/**
 * The square mark on its own, circle-masked — the profile photo on a link-in-bio
 * page, where there is no header to put a wordmark in.
 *
 * Falls back to initials rather than to the Storefront mark: a bio page whose avatar
 * is a different company's logo is worse than one showing two letters.
 */
export function BrandAvatar({
  brand,
  className = "h-20 w-20",
  textClassName = "text-2xl",
}: {
  brand: SiteBrand;
  className?: string;
  textClassName?: string;
}) {
  if (brand.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.iconUrl}
        alt={brand.name}
        width={160}
        height={160}
        className={`${className} shrink-0 rounded-full object-cover shadow-lg`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-[var(--primary)] font-semibold text-[var(--primary-foreground)] shadow-lg ${textClassName}`}
    >
      {brandInitials(brand.name)}
    </span>
  );
}
