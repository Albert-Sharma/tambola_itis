import { SignJWT, jwtVerify } from "jose";
import { headers } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

const MAX_AGE_SECONDS = 60 * 60 * 24; // 24h

export type Session =
  | { role: "admin" }
  | { role: "player"; playerId: string; userId: string };

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return new TextEncoder().encode(s);
}

/**
 * Sessions are signed tokens returned at login and kept in the browser tab's sessionStorage
 * (sent as `Authorization: Bearer`), so every tab/window has its own independent login.
 */
export async function createSession(session: Session): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function getSession(): Promise<Session | null> {
  const auth = (await headers()).get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.role === "admin") return { role: "admin" };
    if (payload.role === "player" && typeof payload.playerId === "string" && typeof payload.userId === "string") {
      return { role: "player", playerId: payload.playerId, userId: payload.userId };
    }
    return null;
  } catch {
    return null;
  }
}

export async function requireAdmin(): Promise<boolean> {
  const s = await getSession();
  return s?.role === "admin";
}

export async function getPlayerSession() {
  const s = await getSession();
  return s?.role === "player" ? s : null;
}

function sha(s: string) {
  return createHash("sha256").update(s).digest();
}

export function checkAdminCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  const okU = timingSafeEqual(sha(username), sha(u));
  const okP = timingSafeEqual(sha(password), sha(p));
  return okU && okP;
}
