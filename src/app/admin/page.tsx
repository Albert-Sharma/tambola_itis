"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NumberBoard, RecentNumbers, announce } from "@/components/Board";
import ImportPanel from "@/components/ImportPanel";
import { apiFetch, clearToken, setToken } from "@/lib/client";

type Game = { status: "waiting" | "running" | "finished"; called: number[]; current: number | null };
type Player = {
  id: string; userId: string; name: string; email: string; phone: string | null;
  numTickets: number; emailSent: boolean;
};
type Lead = { userId: string; name: string; ticketNo: number; hits: number; marked: number };
type AdminState = { game: Game; players: Player[]; leaderboard: Lead[]; totalTickets: number; mailConfigured: boolean; storageMode: "local" | "supabase" };

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

  if (authed === null) return <main className="container"><p className="muted">Loading...</p></main>;
  if (!authed || !state) return <Login onDone={load} />;
  return <Dashboard state={state} reload={load} onLogout={() => { setAuthed(false); setState(null); }} />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Login failed");
    const data = await res.json().catch(() => ({}));
    setToken("admin", data.token);
    onDone();
  }

  return (
    <main className="container narrow">
      <h1 className="title" style={{ textAlign: "center" }}>HOST LOGIN</h1>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="u">Username</label>
        <input id="u" value={username} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        <label htmlFor="p">Password</label>
        <input id="p" type="password" value={password} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required />
        <div style={{ marginTop: 14 }}><button className="btn">Log in</button></div>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}

function Dashboard({ state, reload, onLogout }: { state: AdminState; reload: () => void; onLogout: () => void }) {
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
    if (action === "reset" && !confirm("Reset the game? This clears all called numbers and all players' crosses.")) return;
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

  return (
    <main className="container">
      <div className="topbar">
        <h1 className="title" style={{ fontSize: "2rem", margin: 0 }}>HOST CONSOLE</h1>
        <button className="btn secondary small" onClick={logout}>Log out</button>
      </div>

      {state.storageMode === "local" && (
        <div className="error" style={{ marginBottom: 16 }}>
          LOCAL TEST MODE: data is stored in .data/local-db.json on this PC (not Supabase). Demo players acc001 (1 ticket),
          acc002 (2 tickets) and acc003 (3 tickets) are pre-loaded.
        </div>
      )}

      <div className="grid2">
        <div>
          <section className="panel">
            <div className="hero-number">
              <div className={`ball${rolling ? " rolling" : ""}`}>{display ?? "--"}</div>
              <div>
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  Status: <b>{game.status}</b> &middot; {game.called.length}/90 called
                </p>
                <button className="btn" onClick={draw} disabled={rolling || game.status === "finished" || game.called.length >= 90}>
                  Draw next number
                </button>
                <div className="row nofill" style={{ marginTop: 12 }}>
                  <label style={{ margin: 0 }}>
                    <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} style={{ width: "auto", marginRight: 6 }} />
                    Auto-draw every
                  </label>
                  <select value={interval} onChange={(e) => setIntervalSec(Number(e.target.value))} style={{ width: "auto" }}>
                    {[5, 8, 10, 15, 20, 30].map((s) => <option key={s} value={s}>{s}s</option>)}
                  </select>
                  <label style={{ margin: 0 }}>
                    <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} style={{ width: "auto", marginRight: 6 }} />
                    Voice
                  </label>
                </div>
                {msg && <div className="error">{msg}</div>}
              </div>
            </div>
            <div style={{ marginTop: 14 }}><RecentNumbers called={game.called} /></div>
            <div className="row nofill" style={{ marginTop: 14 }}>
              {game.status !== "finished" ? (
                <button className="btn secondary small" onClick={() => gameAction("finish")}>End game</button>
              ) : (
                <button className="btn secondary small" onClick={() => gameAction("resume")}>Resume game</button>
              )}
              <button className="btn danger small" onClick={() => gameAction("reset")}>Reset game</button>
            </div>
          </section>

          <section className="panel">
            <h2>Called numbers</h2>
            <NumberBoard called={game.called} current={game.current} />
          </section>
        </div>

        <div>
          <AddPlayer mailConfigured={state.mailConfigured} onAdded={reload} />

          <section className="panel">
            <h2>Closest to winning</h2>
            {leaderboard.length === 0 ? (
              <p className="muted">No tickets yet.</p>
            ) : (
              <table className="list">
                <thead><tr><th>Player</th><th>Ticket</th><th>Hit</th><th>Crossed</th></tr></thead>
                <tbody>
                  {leaderboard.map((l, i) => (
                    <tr key={i}>
                      <td>{l.name} ({l.userId})</td><td>#{l.ticketNo}</td><td>{l.hits}/15</td><td>{l.marked}/15</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>

      <ImportPanel onDone={reload} />

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Players ({players.length}) &middot; {state.totalTickets} tickets</h2>
        <PlayersTable players={players} reload={reload} />
      </section>
    </main>
  );
}

function AddPlayer({ mailConfigured, onAdded }: { mailConfigured: boolean; onAdded: () => void }) {
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
        : `Created ${data.userId}, but e-mail was not sent (${data.emailError}). Use "Resend" in the table.`,
    });
    setName(""); setEmail(""); setPhone(""); setNum(1);
    onAdded();
  }

  return (
    <section className="panel">
      <h2>Register player</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        After verifying the Google Form entry and payment screenshot, add the player here. A unique User ID and tickets
        are generated and e-mailed automatically.
      </p>
      {!mailConfigured && <div className="error">SMTP is not configured, e-mails will not be sent.</div>}
      <form onSubmit={submit}>
        <label htmlFor="n">Name</label>
        <input id="n" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="e">E-mail</label>
        <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <div className="row">
          <div>
            <label htmlFor="p">Phone (optional)</label>
            <input id="p" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <label htmlFor="t">Tickets</label>
            <select id="t" value={numTickets} onChange={(e) => setNum(Number(e.target.value))}>
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 14 }}><button className="btn" disabled={busy}>{busy ? "Creating..." : "Create & e-mail tickets"}</button></div>
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
    setNote(d.emailSent ? `Re-sent to ${p.email}` : `Failed: ${d.emailError || d.error}`);
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
      {note && <div className="ok">{note}</div>}
      <div className="table-wrap">
        <table className="list">
          <thead>
            <tr><th>User ID</th><th>Name</th><th>E-mail</th><th>Phone</th><th>Tickets</th><th>Mail</th><th /></tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.id}>
                <td><b>{p.userId}</b></td>
                <td>{p.name}</td>
                <td>{p.email}</td>
                <td>{p.phone}</td>
                <td>{p.numTickets}</td>
                <td><span className={`tag ${p.emailSent ? "good" : "bad"}`}>{p.emailSent ? "sent" : "not sent"}</span></td>
                <td>
                  <button className="btn secondary small" onClick={() => resend(p)}>Resend</button>{" "}
                  <button className="btn danger small" onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
