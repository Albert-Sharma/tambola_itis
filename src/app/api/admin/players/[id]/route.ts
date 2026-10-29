import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { emailPlayer } from "@/lib/registration";

type Ctx = { params: Promise<{ id: string }> };

/** Resend the registration email. */
export async function POST(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const player = await store().getPlayer(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const mail = await emailPlayer(player);
  return NextResponse.json({ emailSent: mail.sent, emailError: mail.error });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await store().deletePlayer(id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
