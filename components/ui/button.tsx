import Link from "next/link";
import { forwardRef } from "react";
import { twMerge } from "tailwind-merge";
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  ReactNode,
  Ref,
} from "react";

/* -------------------------------------------------------------------------- */
/*  cn() — join classes and resolve Tailwind conflicts via tailwind-merge.     */
/*  Because variant/size classes come first and the caller's `className` is    */
/*  passed last, twMerge guarantees per-call overrides (padding, font-weight,  */
/*  text size, hover/active utilities, colors) reliably win over the defaults. */
/* -------------------------------------------------------------------------- */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(" "));
}

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

/* Base classes shared by every button-like element. */
const baseClasses =
  "inline-flex items-center justify-center gap-1.5 font-medium select-none " +
  "transition-all duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 disabled:pointer-events-none";

const variantClasses: Record<ButtonVariant, string> = {
  // Filled brand button. Matches the existing CTA look across cards/checkout.
  primary:
    "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-95 active:scale-[0.98] active:opacity-90",
  // Outlined / bordered button.
  secondary:
    "border border-[var(--border)] text-foreground hover:bg-[var(--background)] active:scale-[0.98]",
  // Transparent, used for nav / tabs / menu items.
  ghost:
    "text-[var(--muted)] hover:text-foreground hover:bg-[var(--accent-subtle)] active:scale-[0.98] active:opacity-80",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-5 py-3.5 text-base font-semibold rounded-xl",
  // Square, icon-only. The padding makes it visually square for w-N/h-N icons.
  icon: "p-2 rounded-lg",
};

/* A spinning loader, sized to match the surrounding text. */
function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/* Props common to every rendered element. */
type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the parent (w-full). */
  fullWidth?: boolean;
  /** Show a spinner and disable interaction. For submit/async buttons. */
  loading?: boolean;
  /** Adds the checkout CTA shimmer effect (requires .btn-cta-shine CSS). */
  shine?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/* As a next/link or <a>: pass an href. `external` forces a plain <a target=_blank>. */
type AnchorProps = CommonProps & {
  href: string;
  /** Render a plain <a target="_blank" rel="noopener noreferrer"> instead of next/link. */
  external?: boolean;
} & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    keyof CommonProps | "href"
  >;

/* As a native <button>: no href. */
type NativeButtonProps = CommonProps & {
  href?: undefined;
  external?: never;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

export type ButtonProps = AnchorProps | NativeButtonProps;

function buildClassName(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean | undefined,
  shine: boolean | undefined,
  className: string | undefined,
): string {
  return cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    shine && "btn-cta-shine",
    className,
  );
}

/* Inner content: spinner (when loading) + optional icons + children. */
function ButtonInner({
  loading,
  leftIcon,
  rightIcon,
  children,
}: Pick<CommonProps, "loading" | "leftIcon" | "rightIcon" | "children">) {
  return (
    <>
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </>
  );
}

/**
 * One reusable, size-adjustable button.
 *
 * - Renders a native <button> by default (type="button" unless you pass type).
 * - Renders next/link <Link> when `href` is set.
 * - Renders a plain <a target="_blank" rel="noopener noreferrer"> when `external` + `href`.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  function Button(props, ref) {
    const {
      variant = "primary",
      size = "md",
      fullWidth,
      loading,
      shine,
      leftIcon,
      rightIcon,
      className,
      children,
      ...rest
    } = props;

    const mergedClassName = buildClassName(variant, size, fullWidth, shine, className);
    const inner = (
      <ButtonInner
        loading={loading}
        leftIcon={leftIcon}
        rightIcon={rightIcon}
      >
        {children}
      </ButtonInner>
    );

    // --- Link / anchor branch ---
    if ("href" in props && props.href != null) {
      const { href, external, ...anchorRest } =
        rest as AnchorHTMLAttributes<HTMLAnchorElement> & {
          href: string;
          external?: boolean;
        };

      if (external) {
        return (
          <a
            ref={ref as Ref<HTMLAnchorElement>}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={mergedClassName}
            aria-busy={loading || undefined}
            {...anchorRest}
          >
            {inner}
          </a>
        );
      }

      return (
        <Link
          ref={ref as Ref<HTMLAnchorElement>}
          href={href}
          className={mergedClassName}
          aria-busy={loading || undefined}
          {...anchorRest}
        >
          {inner}
        </Link>
      );
    }

    // --- Native button branch ---
    const {
      type,
      disabled,
      ...buttonRest
    } = rest as ButtonHTMLAttributes<HTMLButtonElement>;

    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type={type ?? "button"}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={mergedClassName}
        {...buttonRest}
      >
        {inner}
      </button>
    );
  },
);

export default Button;
