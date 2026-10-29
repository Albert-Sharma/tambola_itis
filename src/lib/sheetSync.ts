import { parseCsv, detectMapping, parseCount } from "./importSheet";
import { registerFromForm, EMAIL_RE } from "./registration";

export type SyncSummary = {
  configured: boolean;
  rows: number;
  created: number;
  resent: number;
  failed: number;
  alreadySent: number;
  invalid: string[]; // rows that cannot be processed (bad e-mail / ticket count)
  error?: string;
};

const reportedInvalid = new Set<string>();

function csvUrl() {
  const id = process.env.GOOGLE_SHEET_ID?.trim();
  if (!id) return null;
  const gid = process.env.GOOGLE_SHEET_GID?.trim();
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(id)}/export?format=csv${
    gid ? `&gid=${encodeURIComponent(gid)}` : ""
  }`;
}

/**
 * Reads the Google Form response sheet (must be shared as "Anyone with the link can view") and, for every
 * response whose e-mail has not been mailed yet: creates the player + unique tickets, e-mails the user-id and
 * ticks success_sent_email_1. Safe to call repeatedly.
 */
export async function syncFormResponses(): Promise<SyncSummary> {
  const summary: SyncSummary = { configured: true, rows: 0, created: 0, resent: 0, failed: 0, alreadySent: 0, invalid: [] };
  const url = csvUrl();
  if (!url) return { ...summary, configured: false, error: "GOOGLE_SHEET_ID is not set" };

  let text: string;
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    return { ...summary, error: `Could not read the sheet (${e instanceof Error ? e.message : "error"}). Share it as "Anyone with the link: Viewer".` };
  }
  if (/^\s*<(!doctype|html)/i.test(text)) {
    return { ...summary, error: 'The sheet is private. Share it as "Anyone with the link: Viewer".' };
  }

  const grid = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (grid.length < 2) return summary;
  const headers = grid[0];
  const dataRows = grid.slice(1);
  const mapping = detectMapping(headers, dataRows);
  if (mapping.email < 0 || mapping.tickets < 0) {
    return { ...summary, error: "Could not find the e-mail / tickets columns in the sheet header" };
  }
  summary.rows = dataRows.length;

  for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rowNo = i + 2;
    const get = (idx: number) => (idx >= 0 ? (r[idx] ?? "").trim() : "");
    const email = get(mapping.email).toLowerCase().slice(0, 200);
    const numTickets = parseCount(get(mapping.tickets));
    const name = (get(mapping.name) || email.split("@")[0]).slice(0, 100);

    const problem = !EMAIL_RE.test(email)
      ? "invalid e-mail"
      : !Number.isInteger(numTickets) || numTickets < 1 || numTickets > 3
        ? `tickets must be 1-3 (found "${get(mapping.tickets) || "empty"}")`
        : null;
    if (problem) {
      const msg = `Row ${rowNo}: ${problem}`;
      summary.invalid.push(msg);
      if (!reportedInvalid.has(msg)) {
        reportedInvalid.add(msg);
        console.warn(`[sheet-sync] ${msg}`);
      }
      continue;
    }

    try {
      const out = await registerFromForm({ name, email, numTickets });
      if (out.status === "created") summary.created++;
      else if (out.status === "resent") summary.resent++;
      else if (out.status === "already_sent") summary.alreadySent++;
      else {
        summary.failed++;
        console.error(`[sheet-sync] Row ${rowNo} (${email}): e-mail failed - ${out.emailError}`);
      }
    } catch (e) {
      summary.failed++;
      console.error(`[sheet-sync] Row ${rowNo} (${email}):`, e);
    }
  }
  return summary;
}
