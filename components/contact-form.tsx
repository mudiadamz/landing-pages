"use client";

import { useState } from "react";
import { submitContact } from "@/lib/actions/contacts";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

const HONEYPOT_NAME = "fax";

export function ContactForm() {
  const t = useT();
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function handleSubmit(formData: FormData) {
    setState(null);
    const result = await submitContact(formData);
    setState(result);
    if (result.ok) {
      (document.getElementById("contact-form") as HTMLFormElement)?.reset();
    }
  }

  return (
    <form
      id="contact-form"
      action={handleSubmit}
      className="space-y-4"
    >
      {/* Honeypot: hidden from users, bots often fill it */}
      <div
        className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
        aria-hidden
      >
        <label htmlFor={HONEYPOT_NAME}>{t("contact.honeypot")}</label>
        <input
          id={HONEYPOT_NAME}
          name={HONEYPOT_NAME}
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <label htmlFor="contact-name" className="block text-sm font-medium text-foreground mb-1.5">
          {t("content.name")}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="name"
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
          placeholder={t("panel.yourName")}
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1.5">
          {t("sales.email")}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
          placeholder={t("contact.emailPlaceholder")}
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1.5">
          {t("panel.navGroupMessages")}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent resize-y"
          placeholder={t("contact.messagePlaceholder")}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t("contact.minChars")}</p>
      </div>
      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-[var(--primary)]">{t("contact.sent")}</p>
      )}
      <Button
        type="submit"
        size="md"
        className="w-full sm:w-auto px-6 py-2.5 hover:opacity-90"
      >
        {t("contact.send")}
      </Button>
    </form>
  );
}
