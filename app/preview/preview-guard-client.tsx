"use client";

import { useEffect } from "react";

export function PreviewGuardClient() {
  useEffect(() => {
    function isEditable(t: EventTarget | null) {
      const el = t as HTMLElement | null;
      if (!el || !el.tagName) return false;
      const tag = el.tagName.toUpperCase();
      return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
    }
    function block(e: Event) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    function onKeydown(e: KeyboardEvent) {
      const k = (e.key || "").toLowerCase();
      if (e.key === "F12") return block(e);
      if (e.ctrlKey || e.metaKey) {
        if (["s", "u", "p"].includes(k)) return block(e);
        if (!isEditable(e.target) && ["c", "x"].includes(k)) return block(e);
        if (e.shiftKey && ["i", "j", "c"].includes(k)) return block(e);
      }
    }
    const events: (keyof DocumentEventMap)[] = ["contextmenu", "copy", "cut", "dragstart"];
    events.forEach((evt) => document.addEventListener(evt, block, true));
    document.addEventListener("keydown", onKeydown, true);
    return () => {
      events.forEach((evt) => document.removeEventListener(evt, block, true));
      document.removeEventListener("keydown", onKeydown, true);
    };
  }, []);

  return null;
}
