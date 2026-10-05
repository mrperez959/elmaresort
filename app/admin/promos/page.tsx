import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { listPromos } from "@/lib/promos";
import { todayAtProperty } from "@/lib/dates";
import { PromoManager } from "@/components/PromoManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Influencer codes", robots: { index: false, follow: false } };

export default async function PromosPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [promos, h] = await Promise.all([listPromos(), headers()]);
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Influencer codes</h1>
        <Link href="/admin" className="link">
          ← Back to settings
        </Link>
      </div>
      <p className="promo-intro">
        Guests who use a code get its discount on the nights, on top of the other discounts. The influencer earns the
        commission % of the sale before taxes. Cancelled and refunded bookings reduce the commission automatically.
      </p>
      <PromoManager initial={promos} siteUrl={`${proto}://${host}`} today={todayAtProperty()} />
    </main>
  );
}
