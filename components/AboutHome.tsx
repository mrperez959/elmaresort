import type { Lang } from "@/lib/i18n";

export function AboutHome({ paragraphs, lang }: { paragraphs: string[]; lang: Lang }) {
  return (
    <section className="about" aria-labelledby="about-heading">
      <h2 id="about-heading" data-reveal>{lang === "es" ? "Sobre la casa" : "About the home"}</h2>
      <div data-reveal-group>
        {paragraphs.map((p) => (
          <p key={p} data-reveal>
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}
