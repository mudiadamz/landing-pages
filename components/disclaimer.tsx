import Link from "next/link";
import { getSiteContent } from "@/lib/actions/site-settings";

export async function Disclaimer() {
  const content = await getSiteContent();

  return (
    <section className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20 border-t border-[var(--border)]">
      <div className="space-y-12 sm:space-y-16">
        {/* Disclaimer panjang */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            {content.licenseHeading}
          </h2>
          <div className="space-y-4 text-sm text-[var(--muted)] leading-relaxed">
            {content.licenseParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* Cara pembelian */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            {content.howToHeading}
          </h2>
          <ol className="space-y-3 text-sm text-[var(--muted)] leading-relaxed list-decimal list-inside">
            {content.howToSteps.map((s, i) => (
              <li key={i}>
                <strong className="text-foreground">{s.label}</strong> — {s.text}
              </li>
            ))}
          </ol>
        </div>

        {/* Jaminan support */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-4">
            {content.supportHeading}
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed mb-4">{content.supportIntro}</p>
          <ul className="space-y-2 text-sm text-[var(--muted)] leading-relaxed list-disc list-inside">
            {content.supportPoints.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="text-sm text-[var(--muted)] leading-relaxed mt-4">
            {content.supportOutro}{" "}
            <Link href="/contact" className="text-[var(--primary)] hover:underline font-medium">
              halaman Kontak
            </Link>
          </p>
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mb-6">
            {content.faqHeading}
          </h2>
          <dl className="space-y-6">
            {content.faqs.map((faq, i) => (
              <div key={i}>
                <dt className="text-sm font-medium text-foreground mb-1.5">{faq.q}</dt>
                <dd className="text-sm text-[var(--muted)] leading-relaxed">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
