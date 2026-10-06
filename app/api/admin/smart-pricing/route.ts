import { isAdmin } from "@/lib/auth";
import { getSettings, saveSettings, SettingsError, validateSettings } from "@/lib/settings";
import { readJson, fail } from "@/lib/route-helpers";

export const dynamic = "force-dynamic";

/** Save only the smart pricing part of the settings. */
export async function PUT(req: Request) {
  if (!(await isAdmin())) return fail("Sign in as admin.", 401);
  const body = await readJson(req);
  if (body instanceof Response) return body;
  try {
    const current = await getSettings();
    const next = validateSettings({ ...current, smartPricing: body.smartPricing });
    await saveSettings(next);
    return Response.json({ smartPricing: next.smartPricing });
  } catch (err) {
    if (err instanceof SettingsError) return fail(err.message);
    console.error("[admin/smart-pricing]", err);
    return fail("Couldn't save.", 500);
  }
}
