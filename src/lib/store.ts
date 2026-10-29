import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { db } from "./supabase";
import { generateGrid, gridSignature } from "./ticket";
import type { TitleKey } from "./titles";

export type GameState = {
  status: "waiting" | "running" | "finished";
  called: number[];
  current: number | null;
};

export type PlayerRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  num_tickets: number;
  /** True once the registration e-mail (user-id mail #1) was delivered to the SMTP server. */
  success_sent_email_1: boolean;
  created_at: string;
};

export type TicketRow = {
  id: string;
  player_id: string;
  ticket_no: number;
  grid: number[][];
  marked: number[];
};

export type PlayerWithTickets = PlayerRow & { tickets: TicketRow[] };

export type ClaimRow = {
  id: string;
  title: TitleKey;
  position: number;
  player_id: string;
  ticket_id: string;
  at_call: number;
  created_at: string;
  user_id: string;
  player_name: string;
  ticket_no: number;
};

export interface Store {
  readonly mode: "supabase" | "local";
  getGame(): Promise<GameState>;
  drawNumber(): Promise<number>;
  setStatus(status: GameState["status"]): Promise<void>;
  resetGame(): Promise<void>;
  findPlayerByUserId(userId: string): Promise<{ id: string; user_id: string } | null>;
  getPlayer(id: string): Promise<PlayerRow | null>;
  findPlayerByEmail(email: string): Promise<PlayerRow | null>;
  ticketsForPlayer(playerId: string): Promise<TicketRow[]>;
  getTicket(ticketId: string, playerId: string): Promise<TicketRow | null>;
  setMarked(ticketId: string, marked: number[]): Promise<void>;
  listPlayersWithTickets(): Promise<PlayerWithTickets[]>;
  getPlayerWithTickets(id: string): Promise<PlayerWithTickets | null>;
  playerEmails(): Promise<string[]>;
  createPlayer(input: { name: string; email: string; phone: string | null; numTickets: number }): Promise<{ id: string; user_id: string }>;
  addTicket(playerId: string, ticketNo: number, grid: number[][]): Promise<"ok" | "duplicate">;
  deletePlayer(id: string): Promise<void>;
  markEmailSent(id: string): Promise<void>;
  listClaims(): Promise<ClaimRow[]>;
  /** Atomically takes the next free slot of a title. Returns null if the title is already gone for this ticket. */
  addClaim(input: { title: TitleKey; slots: number; playerId: string; ticketId: string; atCall: number }): Promise<ClaimRow | null>;
}

const sortTickets = <T extends { ticket_no: number }>(t: T[]) => [...t].sort((a, b) => a.ticket_no - b.ticket_no);

/* ------------------------------------------------------------------ */
/* Supabase implementation                                             */
/* ------------------------------------------------------------------ */

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const PLAYER_COLS = "id, user_id, name, email, phone, num_tickets, success_sent_email_1, created_at";

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

const CLAIM_COLS = "id, title, position, player_id, ticket_id, at_call, created_at, players(user_id, name), tickets(ticket_no)";
type Joined<T> = T | T[] | null;
type RawClaim = Omit<ClaimRow, "user_id" | "player_name" | "ticket_no"> & {
  players: Joined<{ user_id: string; name: string }>;
  tickets: Joined<{ ticket_no: number }>;
};
const one = <T>(v: Joined<T>): T | null => (Array.isArray(v) ? v[0] ?? null : v);

function toClaim(r: RawClaim): ClaimRow {
  const p = one(r.players);
  const t = one(r.tickets);
  return {
    id: r.id,
    title: r.title,
    position: r.position,
    player_id: r.player_id,
    ticket_id: r.ticket_id,
    at_call: r.at_call,
    created_at: r.created_at,
    user_id: p?.user_id ?? "",
    player_name: p?.name ?? "",
    ticket_no: t?.ticket_no ?? 0,
  };
}

const supabaseStore: Store = {
  mode: "supabase",

  async getGame() {
    const { data, error } = await db().from("game_state").select("*").eq("id", 1).single();
    if (error || !data) throw new Error(error?.message || "game_state missing");
    return { status: data.status, called: data.called_numbers ?? [], current: data.current_number };
  },
  async drawNumber() {
    const { data, error } = await db().rpc("draw_number");
    fail(error);
    return data as number;
  },
  async setStatus(status) {
    const { error } = await db().from("game_state").update({ status, updated_at: new Date().toISOString() }).eq("id", 1);
    fail(error);
  },
  async resetGame() {
    const a = await db()
      .from("game_state")
      .update({ status: "waiting", called_numbers: [], current_number: null, updated_at: new Date().toISOString() })
      .eq("id", 1);
    fail(a.error);
    const b = await db().from("tickets").update({ marked: [] }).neq("id", ZERO_UUID);
    fail(b.error);
    const c = await db().from("claims").delete().neq("id", ZERO_UUID);
    fail(c.error);
  },
  async findPlayerByUserId(userId) {
    const { data } = await db().from("players").select("id, user_id").eq("user_id", userId).maybeSingle();
    return data ?? null;
  },
  async getPlayer(id) {
    const { data } = await db().from("players").select(PLAYER_COLS).eq("id", id).maybeSingle();
    return (data as PlayerRow) ?? null;
  },
  async findPlayerByEmail(email) {
    const { data } = await db().from("players").select(PLAYER_COLS).eq("email", email.trim().toLowerCase()).limit(1).maybeSingle();
    return (data as PlayerRow) ?? null;
  },
  async ticketsForPlayer(playerId) {
    const { data, error } = await db()
      .from("tickets")
      .select("id, player_id, ticket_no, grid, marked")
      .eq("player_id", playerId)
      .order("ticket_no");
    fail(error);
    return (data ?? []) as TicketRow[];
  },
  async getTicket(ticketId, playerId) {
    const { data } = await db()
      .from("tickets")
      .select("id, player_id, ticket_no, grid, marked")
      .eq("id", ticketId)
      .eq("player_id", playerId)
      .maybeSingle();
    return (data as TicketRow) ?? null;
  },
  async setMarked(ticketId, marked) {
    const { error } = await db().from("tickets").update({ marked }).eq("id", ticketId);
    fail(error);
  },
  async listPlayersWithTickets() {
    const { data, error } = await db()
      .from("players")
      .select(`${PLAYER_COLS}, tickets(id, player_id, ticket_no, grid, marked)`)
      .order("created_at", { ascending: false });
    fail(error);
    return (data ?? []) as PlayerWithTickets[];
  },
  async getPlayerWithTickets(id) {
    const { data } = await db()
      .from("players")
      .select(`${PLAYER_COLS}, tickets(id, player_id, ticket_no, grid, marked)`)
      .eq("id", id)
      .maybeSingle();
    return (data as PlayerWithTickets) ?? null;
  },
  async playerEmails() {
    const { data, error } = await db().from("players").select("email");
    fail(error);
    return (data ?? []).map((p) => String(p.email));
  },
  async createPlayer({ name, email, phone, numTickets }) {
    const { data, error } = await db()
      .from("players")
      .insert({ name, email, phone, num_tickets: numTickets })
      .select("id, user_id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Insert failed");
    return data;
  },
  async addTicket(playerId, ticketNo, grid) {
    const { error } = await db()
      .from("tickets")
      .insert({ player_id: playerId, ticket_no: ticketNo, grid, signature: gridSignature(grid) });
    if (!error) return "ok";
    if (error.code === "23505") return "duplicate";
    throw new Error(error.message);
  },
  async deletePlayer(id) {
    const { error } = await db().from("players").delete().eq("id", id);
    fail(error);
  },
  async markEmailSent(id) {
    await db().from("players").update({ success_sent_email_1: true }).eq("id", id);
  },
  async listClaims() {
    const { data, error } = await db().from("claims").select(CLAIM_COLS).order("created_at");
    fail(error);
    return ((data ?? []) as unknown as RawClaim[]).map(toClaim);
  },
  async addClaim({ title, slots, playerId, ticketId, atCall }) {
    // unique(title, position) and unique(title, ticket_id) make this race-safe; retry if another ticket grabbed our slot first.
    for (let attempt = 0; attempt < 4; attempt++) {
      const { data, error } = await db().from("claims").select("position, ticket_id").eq("title", title);
      fail(error);
      const rows = data ?? [];
      if (rows.some((r) => r.ticket_id === ticketId)) return null;
      const taken = new Set(rows.map((r) => Number(r.position)));
      let position = 0;
      for (let p = 1; p <= slots; p++) {
        if (!taken.has(p)) {
          position = p;
          break;
        }
      }
      if (!position) return null;

      const ins = await db()
        .from("claims")
        .insert({ title, position, player_id: playerId, ticket_id: ticketId, at_call: atCall })
        .select(CLAIM_COLS)
        .single();
      if (!ins.error && ins.data) return toClaim(ins.data as unknown as RawClaim);
      if (ins.error?.code !== "23505") throw new Error(ins.error?.message ?? "Claim failed");
    }
    return null;
  },
};

/* ------------------------------------------------------------------ */
/* Local JSON-file implementation (for testing without Supabase)       */
/* ------------------------------------------------------------------ */

type LocalTicket = TicketRow & { signature: string };
type LocalClaim = Pick<ClaimRow, "id" | "title" | "position" | "player_id" | "ticket_id" | "at_call" | "created_at">;
type LocalData = {
  seq: number;
  game: { status: GameState["status"]; called: number[]; current: number | null };
  players: PlayerRow[];
  tickets: LocalTicket[];
  claims: LocalClaim[];
};

const LOCAL_FILE = path.join(process.cwd(), ".data", "local-db.json");

function userIdFor(n: number) {
  return "acc" + (n < 1000 ? String(n).padStart(3, "0") : String(n));
}

function localAddTicket(d: LocalData, playerId: string, ticketNo: number, grid: number[][]): "ok" | "duplicate" {
  const signature = gridSignature(grid);
  if (d.tickets.some((t) => t.signature === signature)) return "duplicate";
  d.tickets.push({ id: randomUUID(), player_id: playerId, ticket_no: ticketNo, grid, marked: [], signature });
  return "ok";
}

function seedLocal(): LocalData {
  const d: LocalData = { seq: 0, game: { status: "waiting", called: [], current: null }, players: [], tickets: [], claims: [] };
  // Demo players: acc001 -> 1 ticket, acc002 -> 2 tickets, acc003 -> 3 tickets
  for (let count = 1; count <= 3; count++) {
    d.seq++;
    const id = randomUUID();
    d.players.push({
      id,
      user_id: userIdFor(d.seq),
      name: `Demo Player ${count}`,
      email: `demo${count}@example.com`,
      phone: null,
      num_tickets: count,
      success_sent_email_1: false,
      created_at: new Date().toISOString(),
    });
    for (let i = 1; i <= count; i++) {
      while (localAddTicket(d, id, i, generateGrid()) === "duplicate") { /* retry */ }
    }
  }
  return d;
}

function loadLocal(): LocalData {
  const g = globalThis as unknown as { __tambolaLocal?: LocalData };
  if (!g.__tambolaLocal) {
    let data: LocalData;
    try {
      data = JSON.parse(fs.readFileSync(LOCAL_FILE, "utf8"));
    } catch {
      data = seedLocal();
      saveLocal(data);
    }
    g.__tambolaLocal = data;
  }
  // Older local files / cached copies predate claims and the success_sent_email_1 rename.
  g.__tambolaLocal.claims ??= [];
  for (const p of g.__tambolaLocal.players as (PlayerRow & { email_sent?: boolean })[]) {
    p.success_sent_email_1 ??= Boolean(p.email_sent);
    delete p.email_sent;
  }
  return g.__tambolaLocal;
}

function localClaimRow(d: LocalData, c: LocalClaim): ClaimRow {
  const p = d.players.find((x) => x.id === c.player_id);
  const t = d.tickets.find((x) => x.id === c.ticket_id);
  return { ...c, user_id: p?.user_id ?? "", player_name: p?.name ?? "", ticket_no: t?.ticket_no ?? 0 };
}

function saveLocal(d: LocalData) {
  fs.mkdirSync(path.dirname(LOCAL_FILE), { recursive: true });
  fs.writeFileSync(LOCAL_FILE, JSON.stringify(d, null, 2));
}

const withTickets = (d: LocalData, p: PlayerRow): PlayerWithTickets => ({
  ...p,
  tickets: sortTickets(d.tickets.filter((t) => t.player_id === p.id)),
});

const localStore: Store = {
  mode: "local",

  async getGame() {
    const { status, called, current } = loadLocal().game;
    return { status, called: [...called], current };
  },
  async drawNumber() {
    const d = loadLocal();
    if (d.game.status === "finished") throw new Error("Game is finished");
    const remaining: number[] = [];
    for (let n = 1; n <= 90; n++) if (!d.game.called.includes(n)) remaining.push(n);
    if (!remaining.length) throw new Error("All 90 numbers have been drawn");
    const n = remaining[Math.floor(Math.random() * remaining.length)];
    d.game.called.push(n);
    d.game.current = n;
    d.game.status = "running";
    saveLocal(d);
    return n;
  },
  async setStatus(status) {
    const d = loadLocal();
    d.game.status = status;
    saveLocal(d);
  },
  async resetGame() {
    const d = loadLocal();
    d.game = { status: "waiting", called: [], current: null };
    d.tickets.forEach((t) => (t.marked = []));
    d.claims = [];
    saveLocal(d);
  },
  async findPlayerByUserId(userId) {
    const p = loadLocal().players.find((x) => x.user_id === userId);
    return p ? { id: p.id, user_id: p.user_id } : null;
  },
  async getPlayer(id) {
    return loadLocal().players.find((x) => x.id === id) ?? null;
  },
  async findPlayerByEmail(email) {
    const e = email.trim().toLowerCase();
    return loadLocal().players.find((x) => x.email.toLowerCase() === e) ?? null;
  },
  async ticketsForPlayer(playerId) {
    return sortTickets(loadLocal().tickets.filter((t) => t.player_id === playerId));
  },
  async getTicket(ticketId, playerId) {
    return loadLocal().tickets.find((t) => t.id === ticketId && t.player_id === playerId) ?? null;
  },
  async setMarked(ticketId, marked) {
    const d = loadLocal();
    const t = d.tickets.find((x) => x.id === ticketId);
    if (t) t.marked = marked;
    saveLocal(d);
  },
  async listPlayersWithTickets() {
    const d = loadLocal();
    return [...d.players].reverse().map((p) => withTickets(d, p));
  },
  async getPlayerWithTickets(id) {
    const d = loadLocal();
    const p = d.players.find((x) => x.id === id);
    return p ? withTickets(d, p) : null;
  },
  async playerEmails() {
    return loadLocal().players.map((p) => p.email);
  },
  async createPlayer({ name, email, phone, numTickets }) {
    const d = loadLocal();
    d.seq++;
    const p: PlayerRow = {
      id: randomUUID(),
      user_id: userIdFor(d.seq),
      name,
      email,
      phone,
      num_tickets: numTickets,
      success_sent_email_1: false,
      created_at: new Date().toISOString(),
    };
    d.players.push(p);
    saveLocal(d);
    return { id: p.id, user_id: p.user_id };
  },
  async addTicket(playerId, ticketNo, grid) {
    const d = loadLocal();
    const r = localAddTicket(d, playerId, ticketNo, grid);
    if (r === "ok") saveLocal(d);
    return r;
  },
  async deletePlayer(id) {
    const d = loadLocal();
    d.players = d.players.filter((p) => p.id !== id);
    d.tickets = d.tickets.filter((t) => t.player_id !== id);
    d.claims = d.claims.filter((c) => c.player_id !== id);
    saveLocal(d);
  },
  async markEmailSent(id) {
    const d = loadLocal();
    const p = d.players.find((x) => x.id === id);
    if (p) p.success_sent_email_1 = true;
    saveLocal(d);
  },
  async listClaims() {
    const d = loadLocal();
    return d.claims.map((c) => localClaimRow(d, c));
  },
  async addClaim({ title, slots, playerId, ticketId, atCall }) {
    const d = loadLocal();
    const rows = d.claims.filter((c) => c.title === title);
    if (rows.length >= slots || rows.some((c) => c.ticket_id === ticketId)) return null;
    const taken = new Set(rows.map((c) => c.position));
    let position = 1;
    while (taken.has(position)) position++;
    const claim: LocalClaim = {
      id: randomUUID(),
      title,
      position,
      player_id: playerId,
      ticket_id: ticketId,
      at_call: atCall,
      created_at: new Date().toISOString(),
    };
    d.claims.push(claim);
    saveLocal(d);
    return localClaimRow(d, claim);
  },
};

/* ------------------------------------------------------------------ */

/**
 * Local file storage is used when LOCAL_DB=1, or (outside production) when SUPABASE_URL is not set.
 * In production a missing SUPABASE_URL is an error rather than a silent fallback.
 */
export function store(): Store {
  const useLocal =
    process.env.LOCAL_DB === "1" || (!process.env.SUPABASE_URL && process.env.NODE_ENV !== "production");
  return useLocal ? localStore : supabaseStore;
}
