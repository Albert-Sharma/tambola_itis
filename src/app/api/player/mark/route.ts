import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { getPlayerSession } from "@/lib/auth";
import { getGameState, awardClaims, invalidateRaceCache } from "@/lib/game";

const WRONG_MESSAGE = "Acha Acha Achaaa!";

export async function POST(req: Request) {
  const s = await getPlayerSession();
  if (!s) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ticketId = String(body.ticketId ?? "");
  const number = Number(body.number);
  if (!ticketId || !Number.isInteger(number) || number < 1 || number > 90) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const game = await getGameState();
  if (game.status === "finished") {
    return NextResponse.json({ error: "The game is over" }, { status: 409 });
  }

  const ticket = await store().getTicket(ticketId, s.playerId);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const onTicket = (ticket.grid as number[][]).some((row) => row.includes(number));
  if (!onTicket || !game.called.includes(number)) {
    return NextResponse.json({ error: WRONG_MESSAGE, wrong: true }, { status: 422 });
  }

  const marked: number[] = ticket.marked ?? [];
  let nowMarked = marked;
  if (!marked.includes(number)) {
    nowMarked = [...marked, number];
    try {
      await store().setMarked(ticket.id, nowMarked);
      invalidateRaceCache();
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
    }
  }

  // First to cross a title wins it; the store guarantees only one winner per slot.
  let won: string[] = [];
  try {
    won = await awardClaims({ id: s.playerId }, { id: ticket.id, grid: ticket.grid, marked: nowMarked }, game.called.length);
  } catch {
    // The cross is saved; a failed claim attempt is retried on the player's next cross.
  }
  return NextResponse.json({ ok: true, won });
}
