import { syncFormResponses } from "./lib/sheetSync";

/** Background poll of the Google Form response sheet. Runs only when GOOGLE_SHEET_ID is set (local / self-hosted). */
export function startSheetPoller() {
  const g = globalThis as { __tambolaSheetPoller?: boolean };
  if (g.__tambolaSheetPoller || !process.env.GOOGLE_SHEET_ID || process.env.SHEET_POLL === "0") return;
  g.__tambolaSheetPoller = true;

  const seconds = Math.max(15, Number(process.env.SHEET_POLL_SECONDS) || 30);
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const s = await syncFormResponses();
      if (s.error) console.warn(`[sheet-sync] ${s.error}`);
      else if (s.created || s.resent || s.failed) {
        console.log(`[sheet-sync] ${s.created} new, ${s.resent} re-sent, ${s.failed} failed`);
      }
    } catch (e) {
      console.error("[sheet-sync] poll failed", e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 3000);
  setInterval(tick, seconds * 1000);
  console.log(`[sheet-sync] watching Google Sheet every ${seconds}s`);
}
