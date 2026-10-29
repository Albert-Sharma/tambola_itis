import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { parseCount } from "@/lib/importSheet";
import { registerFromForm, EMAIL_RE } from "@/lib/registration";

/**
 * Optional instant trigger: a Google Apps Script bound to the form-responses sheet calls this right after a
 * submission (see google-apps-script/onFormSubmit.gs). Needs the app to be reachable from the internet.
 * Flow: create player (in-game user-id) -> generate unique tickets -> send the e-mail -> tick success_sent_email_1.
 */
function secretMatches(provided: string, expected: string) {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const expected = process.env.FORM_WEBHOOK_SECRET;
  if (!expected || expected.length < 16) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!secretMatches(req.headers.get("x-webhook-secret") ?? "", expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim().slice(0, 100);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const numTickets = parseCount(String(body.tickets ?? "").trim());

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  if (!Number.isInteger(numTickets) || numTickets < 1 || numTickets > 3) {
    return NextResponse.json({ error: "Tickets must be between 1 and 3" }, { status: 400 });
  }

  try {
    const r = await registerFromForm({ name, email, numTickets });
    return NextResponse.json(r, { status: r.emailSent ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Registration failed" }, { status: 500 });
  }
}
