import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { issueTickets } from "@/lib/game";
import { sendTicketsEmail } from "@/lib/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone ?? "").trim().slice(0, 30) || null;
  const numTickets = Number(body.numTickets);

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  if (!Number.isInteger(numTickets) || numTickets < 1 || numTickets > 3) {
    return NextResponse.json({ error: "Tickets must be between 1 and 3" }, { status: 400 });
  }

  let player: { id: string; user_id: string };
  try {
    player = await store().createPlayer({ name, email, phone, numTickets });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Insert failed" }, { status: 500 });
  }

  let grids;
  try {
    grids = await issueTickets(player.id, numTickets);
  } catch (e) {
    await store().deletePlayer(player.id);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ticket generation failed" }, { status: 500 });
  }

  const mail = await sendTicketsEmail({ to: email, name, userId: player.user_id, grids });
  if (mail.sent) await store().markEmailSent(player.id);

  return NextResponse.json({ userId: player.user_id, emailSent: mail.sent, emailError: mail.error });
}
