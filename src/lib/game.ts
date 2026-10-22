import { store, type GameState } from "./store";
import { generateGrid, type Grid } from "./ticket";

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
