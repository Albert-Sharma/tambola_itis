import type { Grid } from "./ticket";

/** Pure (client + server safe) title rules and shared response types. */

export type TitleKey = "early_five" | "top_line" | "middle_line" | "bottom_line" | "full_house";

export type TitleDef = {
  key: TitleKey;
  label: string;
  prize: string;
  /** Numbers a ticket must cross to win this title. */
  size: number;
  /** How many tickets can win it. Only Full House allows more than one. */
  slots: number;
};

export const TITLES: readonly TitleDef[] = [
  { key: "early_five", label: "Early Five", prize: "₹1,500", size: 5, slots: 1 },
  { key: "top_line", label: "Top Line", prize: "₹2,000", size: 5, slots: 1 },
  { key: "middle_line", label: "Middle Line", prize: "₹2,000", size: 5, slots: 1 },
  { key: "bottom_line", label: "Bottom Line", prize: "₹2,000", size: 5, slots: 1 },
  { key: "full_house", label: "Full House", prize: "₹10,000", size: 15, slots: 3 },
];

export const titleDef = (key: TitleKey): TitleDef => TITLES.find((t) => t.key === key)!;

/** How many more numbers a ticket needs to cross for each title (0 = title complete). */
export function ticketNeeds(grid: Grid, marked: number[]): Record<TitleKey, number> {
  const onTicket = new Set(grid.flat().filter((n) => n > 0));
  const m = new Set(marked.filter((n) => onTicket.has(n)));
  const rowNeed = (r: number) => grid[r].filter((n) => n > 0 && !m.has(n)).length;
  return {
    early_five: Math.max(0, 5 - m.size),
    top_line: rowNeed(0),
    middle_line: rowNeed(1),
    bottom_line: rowNeed(2),
    full_house: onTicket.size - m.size,
  };
}

export type ClaimInfo = {
  /** 1 for single-winner titles, 1..3 for Full House. */
  position: number;
  name: string;
  ticketNo: number;
  /** How many numbers had been called when it was won. */
  atCall: number;
  /** Only sent to the admin. */
  userId?: string;
  /** Only sent to players: true if this claim is theirs. */
  mine?: boolean;
};

/** What a player sees for one title. */
export type PlayerTitle = TitleDef & {
  claims: ClaimInfo[];
  slotsLeft: number;
  /** racing = still winnable, claimed = this player holds it, missed = gone ("Oops Missed"). */
  state: "racing" | "claimed" | "missed";
  /** Numbers still needed on the player's closest ticket. */
  needed: number;
  bestTicketNo: number | null;
  /** 1 = closest of all players still racing. */
  rank: number;
  racers: number;
  /** Numbers needed by the current race leader (could be the player). */
  leaderNeeded: number | null;
};

export type Contender = { userId: string; name: string; ticketNo: number; needed: number };

/** What the host sees for one title. */
export type AdminTitle = TitleDef & {
  claims: ClaimInfo[];
  slotsLeft: number;
  contenders: Contender[];
  /** Tickets exactly one number away. */
  oneAway: number;
};
