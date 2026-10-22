export type Role = "admin" | "player";

// sessionStorage is per browser tab, so each tab/window keeps its own independent login.
const KEYS: Record<Role, string> = { admin: "tambola_admin_token", player: "tambola_player_token" };

export function setToken(role: Role, token: string) {
  sessionStorage.setItem(KEYS[role], token);
}

export function clearToken(role: Role) {
  sessionStorage.removeItem(KEYS[role]);
}

/** fetch() that attaches this tab's login token for the given role. */
export function apiFetch(role: Role, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const token = sessionStorage.getItem(KEYS[role]);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, cache: "no-store" });
}
