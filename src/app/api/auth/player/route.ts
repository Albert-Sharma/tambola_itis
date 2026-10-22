import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "").trim().toLowerCase();
  if (!/^acc\d{3,}$/.test(userId)) {
    return NextResponse.json({ error: "Invalid User ID" }, { status: 400 });
  }
  const data = await store().findPlayerByUserId(userId);
  if (!data) return NextResponse.json({ error: "User ID not found" }, { status: 404 });
  const token = await createSession({ role: "player", playerId: data.id, userId: data.user_id });
  return NextResponse.json({ ok: true, token });
}
