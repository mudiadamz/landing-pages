const links = [
  {
    name: "Threads",
    label: "Threads",
    href: "https://www.threads.com/adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.524-8.482C5.845 1.205 8.6 0 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-2.89-2.933-4.349-5.348-4.349-2.415 0-4.244 1.459-5.348 4.349-.628 1.642-.942 3.583-.942 5.756 0 2.172.314 4.114.942 5.756 1.104 2.89 2.933 4.349 5.348 4.349 2.415 0 4.244-1.459 5.348-4.349.314-.823.565-1.72.753-2.67.244-1.22.367-2.537.367-3.928 0-1.237-.157-2.426-.47-3.553-.313-1.127-.84-2.17-1.583-3.105l1.456-1.456c.943 1.127 1.57 2.385 1.878 3.76.308 1.376.462 2.843.462 4.354 0 1.512-.154 2.979-.462 4.354-.308 1.376-.935 2.634-1.878 3.76-.943 1.127-2.078 2.034-3.398 2.712-1.32.678-2.772 1.127-4.342 1.345V24z" />
      </svg>
    ),
  },
  {
    name: "TikTok",
    label: "TikTok",
    href: "https://tiktok.com/@adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    label: "Instagram",
    href: "https://instagram.com/adm.uiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  },
  {
    name: "YouTube",
    label: "YouTube",
    href: "https://youtube.com/@admuiux",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
] as const;

type Props = {
  className?: string;
  variant?: "row" | "stack";
};

export function SocialLinks({ className = "", variant = "row" }: Props) {
  const isStack = variant === "stack";
  return (
    <ul
      className={`flex flex-wrap gap-3 ${isStack ? "flex-col" : "flex-row"} ${className}`}
      aria-label="Tautan media sosial"
    >
      {links.map(({ name, label, href, icon }) => (
        <li key={name}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 text-sm text-[var(--muted)] hover:text-[var(--primary)] active:scale-[0.98] active:opacity-80 transition-all duration-150"
            aria-label={`${name}: ${href}`}
          >
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[var(--accent-subtle)] text-[var(--primary)] shrink-0">
              {icon}
            </span>
            <span className="truncate">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
