import { chatConfigured, chatLimits } from "@/lib/mbahgpt/config";
import { ChatApp } from "./chat-app";
import type { TemplateProps } from "../registry";

/**
 * The MbahGPT homepage: the chat, full viewport, and nothing else.
 *
 * NO header and NO footer here, on purpose — this is the one page where site chrome
 * would break the idea. The chat has its own sidebar and its own composer pinned to
 * the bottom edge; a nav bar above it and a colophon below it would turn an app back
 * into a web page with a widget on it. Secondary pages still get MbahgptHeader, so a
 * visitor who taps through to checkout can find the way back.
 *
 * Of the catalogue props every template receives, this one uses almost none: a chat
 * has no grid to fill. `site` and `user` are what it needs, and the props stay
 * uniform because the CONTRACT is uniform — a template decides how a storefront
 * looks, never what data it is allowed to see.
 */
export function MbahgptHome({ site, user }: TemplateProps) {
  return (
    <>
      {/*
        Two tokens the global palette does not have, scoped to this template.

        `--code-bg` is the ground for code blocks and quiet chips; `--sidebar-bg` is
        the session list's slightly recessed panel. Both are warm neutrals rather
        than the palette's accent tint: a chat transcript is long-form reading, and
        a tinted page fights it. They live here instead of in globals.css because
        nothing outside this template has any use for them.

        In the body, not the head: Next hoists stylesheets with `data-precedence`,
        and a <style> in the head loses to them (docs/architecture.md §5).
      */}
      <style
        dangerouslySetInnerHTML={{
          __html:
            '[data-template="mbahgpt"]{--code-bg:#f6f3ee;--sidebar-bg:#f5f2ec}' +
            '.dark [data-template="mbahgpt"]{--code-bg:#100f0c;--sidebar-bg:#191712}',
        }}
      />
      <ChatApp
        user={user}
        siteName={site.name}
        // Read on the server so the key stays on the server. The page says "chat
        // belum aktif" instead of letting the first message fail with a 503.
        configured={chatConfigured()}
        limits={chatLimits()}
      />
    </>
  );
}
