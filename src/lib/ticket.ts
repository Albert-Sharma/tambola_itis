export type Grid = number[][]; // 3 rows x 9 columns, 0 = blank

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generates a valid Tambola ticket:
 *  - 3 rows x 9 columns, 15 numbers total, exactly 5 per row
 *  - each column has 1-3 numbers, sorted top to bottom
 *  - column 0 holds 1-9, column 1 holds 10-19, ... column 8 holds 80-90
 */
export function generateGrid(): Grid {
  for (let attempt = 0; attempt < 20000; attempt++) {
    const counts: number[] = Array(9).fill(1);
    let extra = 6;
    while (extra > 0) {
      const c = randInt(9);
      if (counts[c] < 3) {
        counts[c]++;
        extra--;
      }
    }

    const rowTotals = [0, 0, 0];
    const placement: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rows = shuffle([0, 1, 2]).slice(0, counts[c]).sort((a, b) => a - b);
      placement.push(rows);
      rows.forEach((r) => rowTotals[r]++);
    }
    if (!rowTotals.every((t) => t === 5)) continue;

    const grid: Grid = [Array(9).fill(0), Array(9).fill(0), Array(9).fill(0)];
    for (let c = 0; c < 9; c++) {
      const lo = c === 0 ? 1 : c * 10;
      const hi = c === 8 ? 90 : c * 10 + 9;
      const pool: number[] = [];
      for (let n = lo; n <= hi; n++) pool.push(n);
      const picked = shuffle(pool).slice(0, counts[c]).sort((a, b) => a - b);
      placement[c].forEach((row, i) => {
        grid[row][c] = picked[i];
      });
    }
    return grid;
  }
  throw new Error("Could not generate ticket");
}

export function gridSignature(grid: Grid): string {
  return grid.flat().join(",");
}
