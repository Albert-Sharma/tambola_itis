import { readSheet } from "read-excel-file/node";

export type Mapping = { email: number; name: number; phone: number; tickets: number }; // -1 = none

export type ImportRow = {
  rowNo: number; // spreadsheet row number (header = 1)
  name: string;
  email: string;
  phone: string;
  numTickets: number;
  issue: string | null; // why the row cannot be imported, if any
  duplicate: boolean; // email already registered / repeated in sheet
};

export type ParsedSheet = { headers: string[]; mapping: Mapping; rows: ImportRow[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3 };

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

/** Minimal RFC4180 CSV parser (quotes, escaped quotes, newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/** Reads the first sheet of an .xlsx file, or a .csv file, into a grid of strings. */
export async function readGrid(buf: Buffer): Promise<string[][]> {
  const isXlsx = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" zip header
  const raw: unknown[][] = isXlsx ? ((await readSheet(buf)) as unknown[][]) : parseCsv(buf.toString("utf8"));
  return raw.map((r) => r.map(cellToString)).filter((r) => r.some((c) => c !== ""));
}

export function detectMapping(headers: string[], dataRows: string[][]): Mapping {
  const h = headers.map((x) => x.toLowerCase());
  const find = (test: (s: string) => boolean) => h.findIndex(test);

  let email = find((s) => /e-?mail/.test(s));
  if (email < 0) {
    // fall back to the column whose values look most like emails
    let best = -1, bestCount = 0;
    for (let c = 0; c < headers.length; c++) {
      const count = dataRows.filter((r) => EMAIL_RE.test(r[c] ?? "")).length;
      if (count > bestCount) { best = c; bestCount = count; }
    }
    email = best;
  }
  const name = find((s) => /name/.test(s) && !/e-?mail|user/.test(s));
  const phone = find((s) => /phone|mobile|contact|whats ?app/.test(s));
  const tickets = find(
    (s) => /ticket|quantity|qty|how many/.test(s) && !/screenshot|upload|payment|proof|file|paid/.test(s)
  );
  return { email, name, phone, tickets };
}

function parseCount(v: string): number {
  const m = v.match(/\d+/);
  if (m) return Number(m[0]);
  const w = v.toLowerCase().match(/\b(one|two|three)\b/);
  return w ? WORDS[w[1]] : NaN;
}

export function buildRows(
  dataRows: string[][],
  mapping: Mapping,
  existingEmails: Set<string>
): ImportRow[] {
  const seen = new Set<string>();
  return dataRows.map((r, i) => {
    const get = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const email = get(mapping.email).toLowerCase();
    const numTickets = parseCount(get(mapping.tickets));
    let name = get(mapping.name);
    if (!name && email) name = email.split("@")[0];

    let issue: string | null = null;
    let duplicate = false;
    if (!EMAIL_RE.test(email)) issue = "Invalid or missing email";
    else if (!Number.isInteger(numTickets) || numTickets < 1 || numTickets > 3) {
      issue = `Tickets must be 1-3 (found "${get(mapping.tickets) || "empty"}")`;
    } else if (existingEmails.has(email)) {
      issue = "Already registered";
      duplicate = true;
    } else if (seen.has(email)) {
      issue = "Repeated in sheet";
      duplicate = true;
    }
    if (email) seen.add(email);

    return {
      rowNo: i + 2,
      name,
      email,
      phone: get(mapping.phone),
      numTickets: Number.isInteger(numTickets) ? numTickets : 0,
      issue,
      duplicate,
    };
  });
}
