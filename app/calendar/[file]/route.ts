import { buildExportCalendar, exportTokenMatches } from "@/lib/calendar-export";

export const dynamic = "force-dynamic";

// GET /calendar/<token>.ics  (paste this link into Airbnb and Vrbo "Import calendar")
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.endsWith(".ics") ? file.slice(0, -4) : file;
  if (!exportTokenMatches(token)) return new Response("Not found", { status: 404 });
  return new Response(await buildExportCalendar(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="elmaresort.ics"',
      "Cache-Control": "no-store",
    },
  });
}

// Some importers check the link with HEAD first.
export async function HEAD(req: Request, ctx: { params: Promise<{ file: string }> }) {
  const res = await GET(req, ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
