"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useL } from "./LangProvider";

type Props = { name: string; email: string; phone: string; whatsapp: string };

export function SiteFooter({ name, email, phone, whatsapp }: Props) {
  const { l } = useL();
  if (usePathname()?.startsWith("/admin")) return null;
  const tel = phone || whatsapp;
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <strong>{name}</strong>
          <p>Tampa, Florida</p>
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
