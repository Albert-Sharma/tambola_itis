import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { getGameState, invalidateRaceCache } from "@/lib/game";

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = await req.json().catch(() => ({ action: "" }));

  try {
    if (action === "finish") {
      await store().setStatus("finished");
    } else if (action === "resume") {
      const g = await getGameState();
      await store().setStatus(g.called.length ? "running" : "waiting");
    } else if (action === "reset") {
      await store().resetGame();
      invalidateRaceCache();
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
