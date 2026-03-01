"use client";

import { useState } from "react";
import { submitContact } from "@/lib/actions/contacts";

const HONEYPOT_NAME = "fax";

export function ContactForm() {
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
        <label htmlFor={HONEYPOT_NAME}>Jangan isi</label>
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
          Nama
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          maxLength={200}
          autoComplete="name"
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
          placeholder="Nama Anda"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="block text-sm font-medium text-foreground mb-1.5">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent"
          placeholder="email@contoh.com"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="block text-sm font-medium text-foreground mb-1.5">
          Pesan
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          className="w-full px-4 py-2.5 border border-[var(--border)] rounded-lg bg-background text-foreground focus:ring-2 focus:ring-[var(--ring)] focus:border-transparent resize-y"
          placeholder="Tulis pesan Anda..."
        />
        <p className="mt-1 text-xs text-[var(--muted)]">Minimal 10 karakter</p>
      </div>
      {state?.error && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-[var(--primary)]">Pesan terkirim. Terima kasih.</p>
      )}
      <button
        type="submit"
        className="w-full sm:w-auto px-6 py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Kirim
      </button>
    </form>
  );
}
