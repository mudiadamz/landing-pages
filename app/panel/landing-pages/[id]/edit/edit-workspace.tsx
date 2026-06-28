"use client";

import { useState } from "react";
import { Editor } from "./editor";
import { PageSettingsForm } from "./page-settings-form";
import type { PreviewType } from "@/lib/actions/landing-pages";

type Props = {
  pageId: string;
  slug: string;
  initialHtml: string;
  initial: {
    title: string;
    preview_type: PreviewType;
    preview_url: string | null;
  };
};

/**
 * Wires the settings form to the HTML editor. The Monaco editor and site/asset
 * uploads only apply to the 'html' preview type, so they are hidden when the
 * page is previewed via an uploaded PDF or an external link.
 */
export function EditWorkspace({ pageId, slug, initialHtml, initial }: Props) {
  const [previewType, setPreviewType] = useState<PreviewType>(initial.preview_type);

  return (
    <>
      <PageSettingsForm
        pageId={pageId}
        slug={slug}
        initial={initial}
        onPreviewTypeChange={setPreviewType}
      />
      {previewType === "html" && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:p-4 shadow-sm overflow-hidden">
          <Editor id={pageId} initialHtml={initialHtml} />
        </div>
      )}
    </>
  );
}
