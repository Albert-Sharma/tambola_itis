import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { syncFormResponses } from "@/lib/sheetSync";

/** Admin "Sync Google Sheet" button: processes any form responses that have not been e-mailed yet. */
export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const summary = await syncFormResponses();
  if (summary.error) return NextResponse.json({ error: summary.error, ...summary }, { status: summary.configured ? 502 : 400 });
  return NextResponse.json(summary);
}
