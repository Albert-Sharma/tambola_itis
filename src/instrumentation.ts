export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSheetPoller } = await import("./sheetPoller");
    startSheetPoller();
  }
}
