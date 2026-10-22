import { NextResponse } from "next/server";
import { checkAdminCredentials, createSession } from "@/lib/auth";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ok = checkAdminCredentials(String(body.username ?? ""), String(body.password ?? ""));
  if (!ok) return NextResponse.json({ error: "Wrong username or password" }, { status: 401 });
  const token = await createSession({ role: "admin" });
  return NextResponse.json({ ok: true, token });
}
