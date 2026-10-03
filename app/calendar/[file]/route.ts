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
      "Cache-Control": "no-store",
    },
  });
}
