import { adminPasswordMatches, startAdminPending, startAdminSession } from "@/lib/auth";
import { sendCode, CodeError } from "@/lib/codes";
import { allow, reset, clientIp } from "@/lib/ratelimit";
import { mailConfigured } from "@/lib/mail";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await readJson(req);
  if (b instanceof Response) return b;
  const ip = clientIp(req);
  if (!(await allow(`admin-login:${ip}`, 5, 900))) return fail("Too many attempts. Wait 15 minutes and try again.", 429);
  if (!adminPasswordMatches(String(b.password ?? ""))) {
    await new Promise((r) => setTimeout(r, 800));
    return fail("Wrong password.", 401);
  }
  await reset(`admin-login:${ip}`);

  // Optional second step: a code sent to ADMIN_EMAIL. Only when ADMIN_2FA=on,
  // so a broken email setup can never lock the owner out of the panel.
  const adminEmail = process.env.ADMIN_EMAIL;
  const twoStep = process.env.ADMIN_2FA === "on";
  if (twoStep && adminEmail && (mailConfigured() || process.env.NODE_ENV !== "production")) {
    try {
      await sendCode(adminEmail, "admin", ip);
    } catch (err) {
      if (!(err instanceof CodeError)) {
        console.error("[admin/login] code email failed", err);
        return fail("The sign-in code couldn't be emailed. Check the email settings.", 500);
      }
    }
    await startAdminPending();
    return Response.json({ ok: true, needsCode: true });
  }
  await startAdminSession();
  return Response.json({ ok: true });
}
