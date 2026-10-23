import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Deployment diagnostics. Reports only whether config is present, never values. */
export async function GET() {
  const env = {
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SESSION_SECRET: Boolean(process.env.SESSION_SECRET),
    SESSION_SECRET_LONG_ENOUGH: (process.env.SESSION_SECRET ?? "").length >= 32,
    ADMIN_USERNAME: Boolean(process.env.ADMIN_USERNAME),
    ADMIN_PASSWORD: Boolean(process.env.ADMIN_PASSWORD),
    SMTP_CONFIGURED: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    LOCAL_DB: process.env.LOCAL_DB ?? null,
  };

  let supabase: { ok: boolean; error?: string } = { ok: false };
  try {
    const { error } = await db().from("game_state").select("id").limit(1);
    supabase = error ? { ok: false, error: error.message.slice(0, 120) } : { ok: true };
  } catch (e) {
    supabase = { ok: false, error: (e instanceof Error ? e.message : "unknown").slice(0, 120) };
  }

  const ok = supabase.ok && env.SESSION_SECRET && env.ADMIN_PASSWORD;
  return NextResponse.json({ ok, env, supabase }, { status: ok ? 200 : 503 });
}
