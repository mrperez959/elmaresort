import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { adminPosts, topBalances } from "@/lib/points";
import { getSettings } from "@/lib/settings";
import { AdminPoints } from "@/components/AdminPoints";

export const dynamic = "force-dynamic";
export const metadata = { title: "Elma Points", robots: { index: false, follow: false } };

export default async function PointsAdminPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [pending, reviewed, balances, settings] = await Promise.all([
    adminPosts("pending"),
    adminPosts("reviewed"),
    topBalances(),
    getSettings(),
  ]);

  return (
    <main className="page admin">
      <div className="account-head">
        <h1 className="admin-title">Elma Points</h1>
        <Link href="/admin" className="link">
          ← Back to settings
        </Link>
      </div>
      <p className="promo-intro">
        Guests send the link to their Instagram post from their account. Open it, check that it tags @elmaresort and says
        they get points (#ad), then enter the likes and comments you see. Points are added right away and the guest gets an
        email. Rules are public at <Link href="/points">/points</Link>.
      </p>
      <AdminPoints pending={pending} reviewed={reviewed} balances={balances} loyalty={settings.loyalty} />
    </main>
  );
}
