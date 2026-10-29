import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { getGameState, adminTitleStatus } from "@/lib/game";
import { mailConfigured } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const game = await getGameState();
  const data = await store().listPlayersWithTickets();

  const called = new Set(game.called);
  type Row = { userId: string; name: string; ticketNo: number; hits: number; marked: number };
  const rows: Row[] = [];

  const players = data.map((p) => {
    for (const t of p.tickets ?? []) {
      const nums = t.grid.flat().filter((n) => n > 0);
      rows.push({
        userId: p.user_id,
        name: p.name,
        ticketNo: t.ticket_no,
        hits: nums.filter((n) => called.has(n)).length,
        marked: t.marked.length,
      });
    }
    return {
      id: p.id,
      userId: p.user_id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      numTickets: p.num_tickets,
      emailSent: p.success_sent_email_1,
      createdAt: p.created_at,
    };
  });

  rows.sort((a, b) => b.hits - a.hits || b.marked - a.marked);
  const titles = await adminTitleStatus();
  return NextResponse.json({
    game,
    players,
    leaderboard: rows.slice(0, 5),
    titles,
    totalTickets: rows.length,
    mailConfigured: mailConfigured(),
    storageMode: store().mode,
  });
}
