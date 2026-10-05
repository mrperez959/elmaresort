import type { Faq as FaqItem } from "@/lib/content";
import type { Lang } from "@/lib/i18n";

/** Questions as native <details>: light on the page, fully readable by search engines. */
export function Faq({ items, lang }: { items: FaqItem[]; lang: Lang }) {
  return (
    <section className="faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading">{lang === "es" ? "Preguntas frecuentes" : "Frequently asked questions"}</h2>
      <div className="faq-list">
        {items.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
