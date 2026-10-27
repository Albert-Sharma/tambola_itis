"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NumberBoard, RecentNumbers, announce } from "@/components/Board";
import ImportPanel from "@/components/ImportPanel";
import { apiFetch, clearToken, setToken } from "@/lib/client";

type Game = { status: "waiting" | "running" | "finished"; called: number[]; current: number | null };
type Player = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  numTickets: number;
  emailSent: boolean;
};
type Lead = { userId: string; name: string; ticketNo: number; hits: number; marked: number };
type AdminState = {
  game: Game;
  players: Player[];
  leaderboard: Lead[];
  totalTickets: number;
  mailConfigured: boolean;
  storageMode: "local" | "supabase";
};

export default function AdminPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("admin", "/api/admin/state");
    if (res.status === 401) return setAuthed(false);
    if (!res.ok) return;
    setState(await res.json());
    setAuthed(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => authed && load(), 3000);
    return () => clearInterval(t);
  }, [load, authed]);

  if (authed === null) {
    return (
      <main className="container narrow" style={{ textAlign: "center", paddingTop: 80 }}>
        <p className="muted">Verifying Host credentials...</p>
      </main>
    );
  }

  if (!authed || !state) return <Login onDone={load} />;

  return (
    <Dashboard
      state={state}
      reload={load}
      onLogout={() => {
        setAuthed(false);
        setState(null);
      }}
    />
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setBusy(false);
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Login failed");
    const data = await res.json().catch(() => ({}));
    setToken("admin", data.token);
    onDone();
  }

  return (
    <main className="container narrow" style={{ maxWidth: 440, paddingTop: 60 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            padding: 10,
            background: "var(--surface-low)",
            borderRadius: 14,
            border: "1px solid rgba(161, 0, 255, 0.4)",
            marginBottom: 12,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: "var(--primary)" }}>
            admin_panel_settings
          </span>
        </div>
        <h1 className="title" style={{ fontSize: "2rem", margin: 0 }}>
          HOST CONSOLE
        </h1>
        <p className="muted" style={{ fontSize: "0.9rem", marginTop: 4 }}>
          Enter administrator credentials to control the game.
        </p>
      </div>

      <form className="panel" onSubmit={submit}>
        <div>
          <label htmlFor="u">Username</label>
          <input
            id="u"
            value={username}
            onChange={(e) => setU(e.target.value)}
            placeholder="admin"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label htmlFor="p">Password</label>
          <input
            id="p"
            type="password"
            value={password}
            onChange={(e) => setP(e.target.value)}
            placeholder="••••••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Signing in..." : "Log In as Host"}
          </button>
        </div>

        <div style={{ marginTop: 14, padding: "8px 12px", background: "rgba(161, 0, 255, 0.08)", borderRadius: 8, fontSize: "0.8rem", color: "var(--on-surface-variant)" }}>
          Demo defaults: Username <code>admin</code> / Password <code>change-me-please</code>
        </div>

        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}

function Dashboard({
  state,
  reload,
  onLogout,
}: {
  state: AdminState;
  reload: () => void;
  onLogout: () => void;
}) {
  const { game, players, leaderboard } = state;
  const [rolling, setRolling] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [auto, setAuto] = useState(false);
  const [interval, setIntervalSec] = useState(10);
  const [voice, setVoice] = useState(true);
  const [msg, setMsg] = useState("");
  const rollingRef = useRef(false);

  const draw = useCallback(async () => {
    if (rollingRef.current) return;
    rollingRef.current = true;
    setRolling(true);
    setMsg("");
    const flicker = setInterval(() => setShown(1 + Math.floor(Math.random() * 90)), 70);
    const [res] = await Promise.all([
      apiFetch("admin", "/api/admin/draw", { method: "POST" }),
      new Promise((r) => setTimeout(r, 900)),
    ]);
    clearInterval(flicker);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setShown(data.number);
      if (voice) announce(data.number);
    } else {
      setShown(null);
      setMsg(data.error || "Could not draw");
      setAuto(false);
    }
    setRolling(false);
    rollingRef.current = false;
    reload();
  }, [reload, voice]);

  useEffect(() => {
    if (!auto || game.status === "finished") return;
    const t = setInterval(draw, interval * 1000);
    return () => clearInterval(t);
  }, [auto, interval, draw, game.status]);

  async function gameAction(action: "finish" | "resume" | "reset") {
    if (
      action === "reset" &&
      !confirm("Reset the game? This clears all called numbers and all players' crosses.")
    )
      return;
    setAuto(false);
    setShown(null);
    await apiFetch("admin", "/api/admin/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    reload();
  }

  async function logout() {
    clearToken("admin");
    onLogout();
  }

  const display = rolling ? shown : game.current;
  const previousBall = game.called.length > 1 ? game.called[game.called.length - 2] : null;

  return (
    <main className="container">
      {/* Top App Bar */}
      <header className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              padding: "6px 8px",
              background: "var(--surface-low)",
              borderRadius: 8,
              border: "1px solid rgba(161, 0, 255, 0.3)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
              sports_esports
            </span>
          </div>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: 0, textTransform: "uppercase" }}>
              Tambola Host Console
            </h1>
            <span style={{ fontSize: "0.78rem", color: "var(--on-surface-variant)" }}>
              Authoritative Game Controller & Telemetry
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "var(--surface-high)",
              border: "1px solid rgba(78, 66, 86, 0.4)",
              borderRadius: 999,
              fontSize: "0.75rem",
              fontFamily: "var(--font-title)",
              color: "var(--tertiary)",
              fontWeight: 700,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--tertiary)" }} />
            Host Connected
          </span>
          <button className="btn secondary small" onClick={logout}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            Log out
          </button>
        </div>
      </header>

      {/* Local Storage Mode Notice */}
      {state.storageMode === "local" && (
        <div
          style={{
            marginBottom: 18,
            padding: "10px 16px",
            borderRadius: 12,
            background: "rgba(0, 226, 144, 0.12)",
            border: "1px solid rgba(0, 226, 144, 0.35)",
            color: "var(--on-surface)",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "var(--tertiary)" }}>
            dns
          </span>
          <span>
            <b>Local Offline Mode Active (LOCAL_DB=1):</b> Data stored in <code>.data/local-db.json</code>. Demo players <code>acc001</code>, <code>acc002</code>, and <code>acc003</code> pre-loaded.
          </span>
        </div>
      )}

      {/* Main 2-Column Bento Engine */}
      <div className="grid2">
        {/* Left Column: Caller & 1-90 Master Grid */}
        <div className="space-y-4" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Caller Hero Card */}
          <section className="panel hero-glow">
            <div className="hero-number">
              {/* Sphere Caller */}
              <div className="ball-glow-wrap">
                <div
                  className="calling-pulse"
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: "50%",
                    background: "rgba(161, 0, 255, 0.4)",
                    filter: "blur(8px)",
                  }}
                />
                <div className={`ball${rolling ? " rolling" : ""}`}>
                  <span
                    style={{
                      fontSize: "0.62rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.14em",
                      fontWeight: 800,
                      opacity: 0.85,
                      marginBottom: -4,
                    }}
                  >
                    Active
                  </span>
                  <span>{display ?? "--"}</span>
                </div>
              </div>

              {/* Status & Draw Trigger */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-title)",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: game.status === "running" ? "rgba(0, 226, 144, 0.2)" : "var(--surface-high)",
                      color: game.status === "running" ? "var(--tertiary)" : "var(--on-surface-variant)",
                      textTransform: "uppercase",
                    }}
                  >
                    Status: {game.status}
                  </span>
                  <span style={{ fontSize: "0.85rem", color: "var(--on-surface-variant)" }}>
                    {game.called.length}/90 numbers called
                  </span>
                </div>

                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn"
                    onClick={draw}
                    disabled={rolling || game.status === "finished" || game.called.length >= 90}
                    style={{ padding: "12px 24px" }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      play_circle
                    </span>
                    <span>{rolling ? "Drawing..." : "Draw Next Number"}</span>
                  </button>
                </div>

                {/* Auto-draw & Voice Controls */}
                <div className="row nofill" style={{ marginTop: 16 }}>
                  <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textTransform: "none" }}>
                    <input
                      type="checkbox"
                      checked={auto}
                      onChange={(e) => setAuto(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>Auto-draw</span>
                  </label>

                  <select
                    value={interval}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    style={{ width: "auto", padding: "6px 10px", fontSize: "0.85rem" }}
                  >
                    {[5, 8, 10, 15, 20, 30].map((s) => (
                      <option key={s} value={s}>
                        {s}s interval
                      </option>
                    ))}
                  </select>

                  <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", textTransform: "none" }}>
                    <input
                      type="checkbox"
                      checked={voice}
                      onChange={(e) => setVoice(e.target.checked)}
                      style={{ width: "auto" }}
                    />
                    <span>Voice</span>
                  </label>
                </div>

                {msg && <div className="error">{msg}</div>}
              </div>
            </div>

            {/* Previous Ball and Actions */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(78, 66, 86, 0.3)" }}>
              <RecentNumbers called={game.called} />
            </div>

            <div
              className="row nofill"
              style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: "1px solid rgba(78, 66, 86, 0.2)",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 8 }}>
                {game.status !== "finished" ? (
                  <button className="btn secondary small" onClick={() => gameAction("finish")}>
                    Pause / End Game
                  </button>
                ) : (
                  <button className="btn secondary small" onClick={() => gameAction("resume")}>
                    Resume Game
                  </button>
                )}
              </div>
              <button className="btn danger small" onClick={() => gameAction("reset")}>
                Reset Game
              </button>
            </div>
          </section>

          {/* 1..90 Called Numbers Board */}
          <section className="panel">
            <h2 style={{ fontSize: "1.25rem", marginBottom: 14 }}>Authoritative 1-90 Master Board</h2>
            <NumberBoard called={game.called} current={game.current} />
          </section>
        </div>

        {/* Right Column: Player Management & Leaderboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Closest to Winning Leaderboard */}
          <section className="panel">
            <div className="panel-header">
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Leaderboard: Closest to Win</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--tertiary)", fontWeight: 700 }}>
                LIVE RANKING
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <p className="muted">No player tickets registered yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="list">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Ticket</th>
                      <th>Hits</th>
                      <th>Crossed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.slice(0, 8).map((l, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: i === 0 ? "var(--tertiary)" : "var(--on-surface-variant)" }}>
                          #{i + 1}
                        </td>
                        <td>
                          <b>{l.name}</b> <span className="muted">({l.userId})</span>
                        </td>
                        <td>Ticket #{l.ticketNo}</td>
                        <td style={{ color: "var(--tertiary)", fontWeight: 700 }}>{l.hits}/15</td>
                        <td>{l.marked}/15</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Quick Player Registration */}
          <AddPlayer mailConfigured={state.mailConfigured} onAdded={reload} />
        </div>
      </div>

      {/* Bulk Excel Import Panel */}
      <div style={{ marginTop: 24 }}>
        <ImportPanel onDone={reload} />
      </div>

      {/* Players & Tickets Directory */}
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-header">
          <h2 style={{ fontSize: "1.3rem", margin: 0 }}>
            Registered Players ({players.length}) &bull; {state.totalTickets} Tickets in Play
          </h2>
        </div>
        <PlayersTable players={players} reload={reload} />
      </section>
    </main>
  );
}

function AddPlayer({
  mailConfigured,
  onAdded,
}: {
  mailConfigured: boolean;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [numTickets, setNum] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await apiFetch("admin", "/api/admin/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, numTickets }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setResult({ ok: false, text: data.error || "Failed" });
    setResult({
      ok: data.emailSent,
      text: data.emailSent
        ? `Created ${data.userId}. Tickets emailed to ${email}.`
        : `Created ${data.userId}, but email was not sent (${data.emailError}). Use "Resend" below.`,
    });
    setName("");
    setEmail("");
    setPhone("");
    setNum(1);
    onAdded();
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Register New Player</h2>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem", marginTop: 0 }}>
        Add approved players. A unique User ID and valid tickets are created automatically.
      </p>
      {!mailConfigured && (
        <div className="error" style={{ fontSize: "0.8rem", marginBottom: 10 }}>
          SMTP is not configured &bull; E-mails will not be sent out.
        </div>
      )}
      <form onSubmit={submit}>
        <div>
          <label htmlFor="n">Player Name</label>
          <input id="n" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" required />
        </div>
        <div>
          <label htmlFor="e">Email Address</label>
          <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" required />
        </div>
        <div className="row">
          <div>
            <label htmlFor="p">Phone (optional)</label>
            <input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91..." />
          </div>
          <div style={{ flex: "0 0 100px" }}>
            <label htmlFor="t">Tickets</label>
            <select id="t" value={numTickets} onChange={(e) => setNum(Number(e.target.value))}>
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy} style={{ width: "100%" }}>
            {busy ? "Registering..." : "Create & Issue Tickets"}
          </button>
        </div>
      </form>
      {result && <div className={result.ok ? "ok" : "error"}>{result.text}</div>}
    </section>
  );
}

function PlayersTable({ players, reload }: { players: Player[]; reload: () => void }) {
  const [note, setNote] = useState("");

  async function resend(p: Player) {
    setNote("Sending...");
    const res = await apiFetch("admin", `/api/admin/players/${p.id}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setNote(d.emailSent ? `Re-sent tickets to ${p.email}` : `Failed: ${d.emailError || d.error}`);
    reload();
  }

  async function remove(p: Player) {
    if (!confirm(`Delete ${p.name} (${p.userId}) and their tickets?`)) return;
    await apiFetch("admin", `/api/admin/players/${p.id}`, { method: "DELETE" });
    reload();
  }

  if (!players.length) return <p className="muted">No players registered yet.</p>;

  return (
    <>
      {note && <div className="ok" style={{ marginBottom: 12 }}>{note}</div>}
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr>
              <th>User ID</th>
              <th>Name</th>
              <th>E-mail</th>
              <th>Phone</th>
              <th>Tickets</th>
              <th>Mail</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td>
                  <b style={{ color: "var(--primary)" }}>{p.userId}</b>
                </td>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.phone || "--"}</td>
                <td style={{ fontWeight: 700 }}>{p.numTickets}</td>
                <td>
                  <span className={`tag ${p.emailSent ? "good" : "bad"}`}>
                    {p.emailSent ? "sent" : "not sent"}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn secondary small" onClick={() => resend(p)}>
                      Resend
                    </button>
                    <button className="btn danger small" onClick={() => remove(p)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
