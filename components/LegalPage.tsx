import { SiteHeader } from "./SiteHeader";
import type { Section } from "@/lib/legal";
import type { PublicUser } from "@/lib/types";

export function LegalPage(props: { user: PublicUser | null; title: string; intro?: string; sections: Section[]; updated?: string }) {
  return (
    <main className="page">
      <SiteHeader user={props.user} showTagline={false} />
      <article className="legal">
        <h1 className="checkout-title">{props.title}</h1>
        {props.intro && <p className="legal-intro">{props.intro}</p>}
        {props.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((t) => (
              <p key={t}>{t}</p>
            ))}
          </section>
        ))}
        {props.updated && <p className="fine">{props.updated}</p>}
      </article>
    </main>
  );
}
