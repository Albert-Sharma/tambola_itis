import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getPlayerSession } from "@/lib/auth";
import { getGameState, playerTitleStatus } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getPlayerSession();
  if (!s) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const player = await store().getPlayer(s.playerId);
  if (!player) return NextResponse.json({ error: "Player no longer exists" }, { status: 401 });

  const tickets = await store().ticketsForPlayer(s.playerId);

  const game = await getGameState();
  const titles = await playerTitleStatus(s.playerId, tickets);
  return NextResponse.json({
    player: { name: player.name, userId: player.user_id },
    tickets: tickets.map((t) => ({ id: t.id, ticketNo: t.ticket_no, grid: t.grid, marked: t.marked })),
    game,
    titles,
  });
}
