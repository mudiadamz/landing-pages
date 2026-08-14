"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPage } from "@/lib/actions/pages";
import { useT } from "@/lib/i18n/client";

/** Asks for the one thing a new page cannot be given automatically: its title. */
export function NewPageButton() {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const res = await createPage(title);
    setBusy(false);
    if (res.ok) router.push(`/panel/pages/${res.id}`);
    else setError(res.error);
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t("panel.newPage")}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && title.trim() && create()}
        placeholder={t("panel.pageTitlePlaceholder")}
        maxLength={120}
        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-base sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
      <Button type="button" size="sm" onClick={create} disabled={busy || !title.trim()}>
        {busy ? t("panel.creating") : t("panel.create")}
      </Button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
