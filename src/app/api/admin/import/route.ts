import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { buildRows, detectMapping, readGrid, type Mapping } from "@/lib/importSheet";

const MAX_BYTES = 5 * 1024 * 1024;

/** Parses an uploaded Google Form responses sheet (.xlsx or .csv) and returns a preview. Nothing is saved. */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return NextResponse.json({ error: "Please choose a file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });

  let grid: string[][];
  try {
    grid = await readGrid(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "Could not read the file. Upload an .xlsx or .csv export." }, { status: 400 });
  }
  if (grid.length < 2) return NextResponse.json({ error: "The sheet has no data rows" }, { status: 400 });

  const headers = grid[0];
  const dataRows = grid.slice(1);

  const mapping = detectMapping(headers, dataRows);
  for (const key of ["email", "name", "phone", "tickets"] as const) {
    const raw = form.get(`${key}Col`);
    if (raw !== null && raw !== "") {
      const n = Number(raw);
      if (Number.isInteger(n) && n >= -1 && n < headers.length) (mapping as Mapping)[key] = n;
    }
  }

  const existingEmails = new Set((await store().playerEmails()).map((e) => e.toLowerCase()));

  return NextResponse.json({ headers, mapping, rows: buildRows(dataRows, mapping, existingEmails) });
}
