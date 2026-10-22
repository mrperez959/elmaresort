"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useL } from "./LangProvider";

type Props = { name: string; email: string; phone: string; whatsapp: string; instagram: string; facebook: string };

/** Simple outline glyphs in the footer's text color (lucide has no brand icons). */
function InstagramIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3z"
      />
    </svg>
  );
}

export function SiteFooter({ name, email, phone, whatsapp, instagram, facebook }: Props) {
  const { l } = useL();
  if (usePathname()?.startsWith("/admin")) return null;
  const tel = phone;
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <strong>{name}</strong>
          <p>Tampa, Florida</p>
          {(instagram || facebook) && (
            <div className="social" aria-label={l("Follow us", "Síguenos")}>
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer me" aria-label="Instagram">
                  <InstagramIcon />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer me" aria-label="Facebook">
                  <FacebookIcon />
                </a>
              )}
            </div>
          )}
        </div>
        <div>
          <strong>{l("Contact", "Contacto")}</strong>
          {email && (
            <p>
              <a href={`mailto:${email}`}>{email}</a>
            </p>
          )}
          {tel && (
            <p>
              <a href={`tel:${tel}`}>{tel}</a>
            </p>
          )}
          {whatsapp && (
            <p>
              <a href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
            </p>
          )}
        </div>
        <nav aria-label={l("Policies", "Políticas")}>
          <strong>{l("Policies", "Políticas")}</strong>
          <p>
            <Link href="/house-rules">{l("House rules", "Reglas de la casa")}</Link>
          </p>
          <p>
            <Link href="/rental-agreement">{l("Rental agreement", "Contrato de alquiler")}</Link>
          </p>
          <p>
            <Link href="/refunds">{l("Cancellation and refunds", "Cancelaciones y reembolsos")}</Link>
          </p>
          <p>
            <Link href="/privacy">{l("Privacy policy", "Política de privacidad")}</Link>
          </p>
        </nav>
      </div>
    </footer>
  );
}
