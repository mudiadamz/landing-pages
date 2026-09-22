// Inline brand mark, kept in sync with app/icon.svg (the favicon).
// Rendered next to the brand wordmark in the site header + panel sidebar.
export function BrandMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={`${className} shrink-0`}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#1a5f4a" />
      <text
        x="16"
        y="22"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="16"
        fontWeight="700"
        fill="white"
        textAnchor="middle"
      >S</text>
    </svg>
  );
}
