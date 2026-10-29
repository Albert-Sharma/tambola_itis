import { store, type ClaimRow, type GameState, type TicketRow } from "./store";
import { generateGrid, type Grid } from "./ticket";
import {
  TITLES,
  ticketNeeds,
  type AdminTitle,
  type ClaimInfo,
  type PlayerTitle,
  type TitleKey,
} from "./titles";

export type { GameState };

export function getGameState(): Promise<GameState> {
  return store().getGame();
}

/** Creates `count` unique tickets for a player and returns their grids. */
export async function issueTickets(playerId: string, count: number): Promise<Grid[]> {
  const grids: Grid[] = [];
  for (let i = 0; i < count; i++) {
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const grid = generateGrid();
      if ((await store().addTicket(playerId, i + 1, grid)) === "ok") {
        grids.push(grid);
        saved = true;
      }
    }
    if (!saved) throw new Error("Could not generate a unique ticket");
  }
  return grids;
}

/* ------------------------------------------------------------------ */
/* Prize titles: live race + first-to-cross claiming                   */
/* ------------------------------------------------------------------ */

type RaceTicket = { id: string; ticketNo: number; needs: Record<TitleKey, number> };
type RaceEntry = { playerId: string; userId: string; name: string; tickets: RaceTicket[] };

const RACE_TTL_MS = 1500;
type RaceCache = { at: number; promise: Promise<RaceEntry[]> };
const cacheHolder = globalThis as unknown as { __tambolaRace?: RaceCache | null };

/** Everyone's progress, shared for a moment so many polling clients don't each hit the database. */
function raceEntries(): Promise<RaceEntry[]> {
  const now = Date.now();
  const cached = cacheHolder.__tambolaRace;
  if (cached && now - cached.at < RACE_TTL_MS) return cached.promise;

  const promise = store()
    .listPlayersWithTickets()
    .then((players) =>
      players.map<RaceEntry>((p) => ({
        playerId: p.id,
        userId: p.user_id,
        name: p.name,
        tickets: (p.tickets ?? []).map((t) => ({
          id: t.id,
          ticketNo: t.ticket_no,
          needs: ticketNeeds(t.grid, t.marked ?? []),
        })),
      }))
    );
  const entry: RaceCache = { at: now, promise };
  cacheHolder.__tambolaRace = entry;
  promise.catch(() => {
    if (cacheHolder.__tambolaRace === entry) cacheHolder.__tambolaRace = null;
  });
  return promise;
}

export function invalidateRaceCache() {
  cacheHolder.__tambolaRace = null;
}

function claimInfo(c: ClaimRow, extra: Partial<ClaimInfo>): ClaimInfo {
  return { position: c.position, name: c.player_name, ticketNo: c.ticket_no, atCall: c.at_call, ...extra };
}

/**
 * Called after a ticket's crosses change. Awards every title this ticket has just completed,
 * first come first served. Returns the titles this ticket won.
 */
export async function awardClaims(
  player: { id: string },
  ticket: { id: string; grid: Grid; marked: number[] },
  atCall: number
): Promise<TitleKey[]> {
  const needs = ticketNeeds(ticket.grid, ticket.marked);
  const complete = TITLES.filter((t) => needs[t.key] === 0);
  if (!complete.length) return [];

  const existing = await store().listClaims();
  const won: TitleKey[] = [];
  for (const def of complete) {
    const forTitle = existing.filter((c) => c.title === def.key);
    if (forTitle.length >= def.slots || forTitle.some((c) => c.ticket_id === ticket.id)) continue;
    const row = await store().addClaim({
      title: def.key,
      slots: def.slots,
      playerId: player.id,
      ticketId: ticket.id,
      atCall,
    });
    if (row) won.push(def.key);
  }
  if (won.length) invalidateRaceCache();
  return won;
}

function bestNeeded(e: RaceEntry, key: TitleKey, heldTickets: Set<string>): number | null {
  let best: number | null = null;
  for (const t of e.tickets) {
    if (heldTickets.has(t.id)) continue;
    if (best === null || t.needs[key] < best) best = t.needs[key];
  }
  return best;
}

/** Per-title view for one player: their progress, rank in the race, and whether it is still open. */
export async function playerTitleStatus(playerId: string, tickets: TicketRow[]): Promise<PlayerTitle[]> {
  const [entries, claims] = await Promise.all([raceEntries(), store().listClaims()]);

  return TITLES.map((def) => {
    const forTitle = claims.filter((c) => c.title === def.key);
    const heldTickets = new Set(forTitle.map((c) => c.ticket_id));
    const slotsLeft = Math.max(0, def.slots - forTitle.length);
    const iHold = forTitle.some((c) => c.player_id === playerId);

    // My closest ticket that has not already won this title (uses fresh marks, not the cached snapshot).
    let needed: number | null = null;
    let bestTicketNo: number | null = null;
    for (const t of tickets) {
      if (heldTickets.has(t.id)) continue;
      const n = ticketNeeds(t.grid, t.marked ?? [])[def.key];
      if (needed === null || n < needed) {
        needed = n;
        bestTicketNo = t.ticket_no;
      }
    }

    // Rivals: players other than me, ranked by their closest unclaimed ticket.
    const rivals: number[] = [];
    for (const e of entries) {
      if (e.playerId === playerId) continue;
      const n = bestNeeded(e, def.key, heldTickets);
      if (n !== null) rivals.push(n);
    }

    const racing = needed !== null && slotsLeft > 0;
    const rank = racing ? 1 + rivals.filter((n) => n < (needed as number)).length : 0;
    const everyone = racing ? [...rivals, needed as number] : rivals;

    return {
      ...def,
      claims: forTitle.map((c) => claimInfo(c, { mine: c.player_id === playerId })),
      slotsLeft,
      state: iHold ? "claimed" : slotsLeft === 0 ? "missed" : "racing",
      needed: needed ?? 0,
      bestTicketNo,
      rank,
      racers: everyone.length,
      leaderNeeded: slotsLeft > 0 && everyone.length ? Math.min(...everyone) : null,
    };
  });
}

/** Per-title view for the host: winners so far and the closest contenders. */
export async function adminTitleStatus(): Promise<AdminTitle[]> {
  const [entries, claims] = await Promise.all([raceEntries(), store().listClaims()]);

  return TITLES.map((def) => {
    const forTitle = claims.filter((c) => c.title === def.key);
    const heldTickets = new Set(forTitle.map((c) => c.ticket_id));
    const slotsLeft = Math.max(0, def.slots - forTitle.length);

    const open =
      slotsLeft > 0
        ? entries.flatMap((e) =>
            e.tickets
              .filter((t) => !heldTickets.has(t.id))
              .map((t) => ({ userId: e.userId, name: e.name, ticketNo: t.ticketNo, needed: t.needs[def.key] }))
          )
        : [];
    open.sort((a, b) => a.needed - b.needed || a.userId.localeCompare(b.userId));

    return {
      ...def,
      claims: forTitle.map((c) => claimInfo(c, { userId: c.user_id })),
      slotsLeft,
      contenders: open.slice(0, 5),
      oneAway: open.filter((c) => c.needed === 1).length,
    };
  });
}
