import { isAdmin, isJsonRequest } from "@/lib/auth";
import { getSettings, saveSettings, SettingsError, validateSettings } from "@/lib/settings";
import { clearFeedCache } from "@/lib/ical";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  return Response.json({ settings: await getSettings() });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "Sign in as admin." }, { status: 401 });
  if (!isJsonRequest(req)) return Response.json({ error: "Unsupported request." }, { status: 415 });
  try {
    const settings = await saveSettings(validateSettings(await req.json()));
    clearFeedCache();
    return Response.json({ settings });
  } catch (err) {
    if (err instanceof SettingsError) return Response.json({ error: err.message }, { status: 400 });
    console.error("[admin/settings]", err);
    return Response.json({ error: "Settings couldn't be saved." }, { status: 500 });
  }
}
