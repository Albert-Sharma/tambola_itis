"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberBoard, RecentNumbers, announce } from "@/components/Board";
import { apiFetch, clearToken } from "@/lib/client";

type Ticket = { id: string; ticketNo: number; grid: number[][]; marked: number[] };
type Game = { status: "waiting" | "running" | "finished"; called: number[]; current: number | null };
type State = { player: { name: string; userId: string }; tickets: Ticket[]; game: Game };

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [popup, setPopup] = useState(false);
  const [voice, setVoice] = useState(true);
  const [err, setErr] = useState("");
  const [pop, setPop] = useState(false);
  const lastCurrent = useRef<number | null | undefined>(undefined);
  const voiceRef = useRef(true);
  voiceRef.current = voice;

  const load = useCallback(async () => {
    const res = await apiFetch("player", "/api/player/state");
    if (res.status === 401) return router.replace("/");
    if (!res.ok) return;
    const data: State = await res.json();
    const cur = data.game.current;
    if (lastCurrent.current !== undefined && cur !== lastCurrent.current && cur) {
      setPop(true);
      setTimeout(() => setPop(false), 600);
      if (voiceRef.current) announce(cur);
    }
    lastCurrent.current = cur;
    setState(data);
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(false), 2400);
    return () => clearTimeout(t);
  }, [popup]);

  async function mark(ticketId: string, n: number) {
    setErr("");
    const res = await apiFetch("player", "/api/player/mark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, number: n }),
    });
    if (res.status === 422) return setPopup(true);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return setErr(d.error || "Something went wrong");
    }
    setState((s) =>
      s ? { ...s, tickets: s.tickets.map((t) => (t.id === ticketId ? { ...t, marked: [...new Set([...t.marked, n])] } : t)) } : s
    );
  }

  async function logout() {
    clearToken("player");
    router.replace("/");
  }

  if (!state) return <main className="container"><p className="muted">Loading your tickets...</p></main>;
  const { game, player, tickets } = state;

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1 className="title" style={{ fontSize: "2rem", margin: 0 }}>TAMBOLA</h1>
          <span className="muted">Hi {player.name} &middot; ID: <b>{player.userId}</b></span>
        </div>
        <div className="row nofill">
          <label style={{ margin: 0 }}>
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} style={{ width: "auto", marginRight: 6 }} />
            Voice
          </label>
          <button className="btn secondary small" onClick={logout}>Log out</button>
        </div>
      </div>

      <section className="panel">
        <div className="hero-number">
          <div className={`ball${pop ? " pop" : ""}`}>{game.current ?? "--"}</div>
          <div>
            <h2 style={{ margin: 0 }}>
              {game.status === "waiting" && "Waiting for the host to start..."}
              {game.status === "running" && "Number called!"}
              {game.status === "finished" && "Game over. Thanks for playing!"}
            </h2>
            <p className="muted">{game.called.length} of 90 numbers called</p>
            <RecentNumbers called={game.called} />
          </div>
        </div>
      </section>

      {err && <div className="error">{err}</div>}

      <h2 style={{ marginTop: 24 }}>Your tickets ({tickets.length})</h2>
      <div className="tickets">
        {tickets.map((t) => {
          const marked = new Set(t.marked);
          const full = marked.size === 15;
          return (
            <div key={t.id} className={`ticket${full ? " full" : ""}`}>
              <header>
                <span>Ticket {t.ticketNo}</span>
                <span>{full ? "FULL HOUSE!" : `${marked.size}/15 crossed`}</span>
              </header>
              <table>
                <tbody>
                  {t.grid.map((row, r) => (
                    <tr key={r}>
                      {row.map((n, c) =>
                        n === 0 ? (
                          <td key={c} className="tcell blank" />
                        ) : (
                          <td
                            key={c}
                            className={`tcell num${marked.has(n) ? " marked" : ""}`}
                            onClick={() => !marked.has(n) && mark(t.id, n)}
                          >
                            {n}
                          </td>
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>

      <h2 style={{ marginTop: 24 }}>Called numbers</h2>
      <section className="panel">
        <NumberBoard called={game.called} current={game.current} />
      </section>

      {popup && (
        <div className="popup-backdrop" onClick={() => setPopup(false)}>
          <div className="popup">
            <div className="emoji">🙈</div>
            <div className="big">Acha Acha Achaaa!</div>
            <p>That number hasn&apos;t been called yet.</p>
          </div>
        </div>
      )}
    </main>
  );
}
