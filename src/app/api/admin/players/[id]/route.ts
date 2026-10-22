import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { sendTicketsEmail } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

/** Resend the ticket email. */
export async function POST(_req: Request, { params }: Ctx) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const player = await store().getPlayerWithTickets(id);
  if (!player) return NextResponse.json({ error: "Player not found" }, { status: 404 });

  const grids = [...(player.tickets ?? [])]
    .sort((a, b) => a.ticket_no - b.ticket_no)
    .map((t) => t.grid);
  const mail = await sendTicketsEmail({ to: player.email, name: player.name, userId: player.user_id, grids });
  if (mail.sent) await store().markEmailSent(id);
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
