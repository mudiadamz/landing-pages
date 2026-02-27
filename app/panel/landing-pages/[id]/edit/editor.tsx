"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { updateLandingPageHtml } from "@/lib/actions/landing-pages";

export function Editor({
  id,
  slug,
  initialHtml,
}: {
  id: string;
  slug: string;
  initialHtml: string;
}) {
  const router = useRouter();
  const [html, setHtml] = useState(initialHtml);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPageHtml(id, html);
      setMessage({ type: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setMessage({
        type: "err",
        text: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }, [id, html, router]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    },
    [save]
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-foreground text-background rounded-md font-medium text-sm hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <span className="text-xs text-foreground/60">Cmd/Ctrl+S to save</span>
        {message && (
          <span
            className={
              message.type === "ok"
                ? "text-sm text-green-600 dark:text-green-400"
                : "text-sm text-red-600 dark:text-red-400"
            }
          >
            {message.text}
          </span>
        )}
      </div>
      <textarea
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        className="w-full h-[70vh] min-h-[300px] p-4 font-mono text-sm border border-foreground/20 rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/30 resize-y"
        placeholder="<!DOCTYPE html>..."
      />
    </div>
  );
}
