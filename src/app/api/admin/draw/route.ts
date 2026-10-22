import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";

export async function POST() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ number: await store().drawNumber() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Draw failed" }, { status: 409 });
  }
}
