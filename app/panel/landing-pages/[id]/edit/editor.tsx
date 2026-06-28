"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { updateLandingPageHtml } from "@/lib/actions/landing-pages";
import { parseHtmlContent, mergeHtmlContent } from "@/lib/editor-utils";
import { AssetUpload } from "./asset-upload";
import { Button } from "@/components/ui/button";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[60vh] min-h-[280px] rounded-lg border border-[var(--border)] bg-[var(--background)] flex items-center justify-center text-[var(--muted)]">
      Loading editor…
    </div>
  ),
});

type Tab = "html" | "css" | "js";

export function Editor({
  id,
  initialHtml,
}: {
  id: string;
  initialHtml: string;
}) {
  const router = useRouter();
  const parsed = parseHtmlContent(initialHtml);
  const [html, setHtml] = useState(parsed.html);
  const [css, setCss] = useState(parsed.css);
  const [js, setJs] = useState(parsed.js);
  const [activeTab, setActiveTab] = useState<Tab>("html");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const lastSavedRef = useRef<string>(mergeHtmlContent(parsed.html, parsed.css, parsed.js));

  const save = useCallback(async () => {
    const merged = mergeHtmlContent(html, css, js);
    if (merged === lastSavedRef.current) {
      setMessage({ type: "ok", text: "No changes." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await updateLandingPageHtml(id, merged);
      lastSavedRef.current = merged;
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
  }, [id, html, css, js, router]);

  // A site ZIP upload replaces the page HTML server-side; mirror it into the editor.
  const handleSiteUploaded = useCallback((fullHtml: string) => {
    const p = parseHtmlContent(fullHtml);
    setHtml(p.html);
    setCss(p.css);
    setJs(p.js);
    lastSavedRef.current = mergeHtmlContent(p.html, p.css, p.js);
    setMessage({ type: "ok", text: "Site ZIP uploaded — preview updated." });
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    },
    [save]
  );

  const tabs: { id: Tab; label: string; language: string; value: string; onChange: (v: string) => void }[] = [
    { id: "html", label: "HTML", language: "html", value: html, onChange: setHtml },
    { id: "css", label: "CSS", language: "css", value: css, onChange: setCss },
    { id: "js", label: "JavaScript", language: "javascript", value: js, onChange: setJs },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 bg-[var(--background)]">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === t.id
                    ? "bg-[var(--card)] text-foreground shadow-sm"
                    : "text-[var(--muted)] hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            onClick={() => save()}
            size="md"
            loading={saving}
            disabled={saving}
            className="py-2.5 shadow-sm hover:opacity-95"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <span className="text-xs text-[var(--muted)] hidden sm:inline">
            Cmd/Ctrl+S to save
          </span>
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <MonacoEditor
              height="60vh"
              language={currentTab.language}
              value={currentTab.value}
              onChange={(v) => currentTab.onChange(v ?? "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: "on",
                wordWrap: "on",
                padding: { top: 12 },
                scrollBeyondLastLine: false,
              }}
            />
          </div>
        </div>

        <div className="space-y-4">
          <AssetUpload pageId={id} onSiteUploaded={handleSiteUploaded} />
        </div>
      </div>
    </div>
  );
}
