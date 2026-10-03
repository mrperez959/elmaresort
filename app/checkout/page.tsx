import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Checkout } from "@/components/Checkout";
import { currentUser } from "@/lib/auth";
import { parseStayRequest, QuoteError } from "@/lib/quote";

export const dynamic = "force-dynamic";
export const metadata = { title: "Confirm and pay" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams;
  let stay;
  try {
    stay = parseStayRequest(params);
  } catch (err) {
    if (err instanceof QuoteError) redirect("/#book");
    throw err;
  }
  if (stay.adults < 1) stay.adults = 1;
  const user = await currentUser();

  return (
    <main className="page">
      <SiteHeader user={user} showTagline={false} />
      <h1 className="checkout-title">Confirm and pay</h1>
      <Checkout stay={stay} user={user} />
    </main>
  );
}
