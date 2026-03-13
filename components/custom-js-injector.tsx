"use client";

import { usePathname } from "next/navigation";

export function CustomJsInjector({ script }: { script: string }) {
  const pathname = usePathname();
  if (!script || pathname?.startsWith("/panel")) return null;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
