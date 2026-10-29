import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createPlayerWithTickets, emailPlayer, EMAIL_RE } from "@/lib/registration";

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
    player = await createPlayerWithTickets({ name, email, phone, numTickets });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Insert failed" }, { status: 500 });
  }

  const mail = await emailPlayer({ id: player.id, user_id: player.user_id, name, email, num_tickets: numTickets });

  return NextResponse.json({ userId: player.user_id, emailSent: mail.sent, emailError: mail.error });
}
