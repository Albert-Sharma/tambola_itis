"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NumberBoard, RecentNumbers, announce } from "@/components/Board";
import { apiFetch, clearToken } from "@/lib/client";

type Ticket = { id: string; ticketNo: number; grid: number[][]; marked: number[] };
type Game = { status: "waiting" | "running" | "finished"; called: number[]; current: number | null };
type State = { player: { name: string; userId: string }; tickets: Ticket[]; game: Game };

type ViewMode = "all" | "single" | "compact";

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [popup, setPopup] = useState(false);
  const [voice, setVoice] = useState(true);
  const [err, setErr] = useState("");
  const [pop, setPop] = useState(false);
  const [claimToast, setClaimToast] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);
  const [dabAllBusy, setDabAllBusy] = useState(false);

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

  useEffect(() => {
    if (!claimToast) return;
    const t = setTimeout(() => setClaimToast(null), 3500);
    return () => clearTimeout(t);
  }, [claimToast]);

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
      s
        ? {
            ...s,
            tickets: s.tickets.map((t) =>
              t.id === ticketId ? { ...t, marked: [...new Set([...t.marked, n])] } : t
            ),
          }
        : s
    );
  }

  // Auto-Dab: automatically dabs all called numbers for all player tickets
  async function handleDabAll() {
    if (!state || dabAllBusy) return;
    setDabAllBusy(true);
    const calledSet = new Set(state.game.called);
    let markedCount = 0;

    for (const ticket of state.tickets) {
      const markedSet = new Set(ticket.marked);
      const toMark: number[] = [];
      for (const row of ticket.grid) {
        for (const num of row) {
          if (num > 0 && calledSet.has(num) && !markedSet.has(num)) {
            toMark.push(num);
          }
        }
      }

      for (const num of toMark) {
        await apiFetch("player", "/api/player/mark", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticketId: ticket.id, number: num }),
        });
        markedCount++;
      }
    }

    await load();
    setDabAllBusy(false);
    setClaimToast(markedCount > 0 ? `Dabbed ${markedCount} number${markedCount > 1 ? "s" : ""} across tickets!` : "All called numbers are already dabbed!");
  }

  async function logout() {
    clearToken("player");
    router.replace("/");
  }

  // Calculate live prize status for player's tickets
  const prizeStatus = useMemo(() => {
    if (!state?.tickets) return null;
    let minEarly5Needed = 5;
    let minTopLineNeeded = 5;
    let minMidLineNeeded = 5;
    let minBotLineNeeded = 5;
    let minFullHouseNeeded = 15;

    for (const t of state.tickets) {
      const marked = new Set(t.marked);
      const early5Needed = Math.max(0, 5 - marked.size);
      if (early5Needed < minEarly5Needed) minEarly5Needed = early5Needed;

      const fullHouseNeeded = Math.max(0, 15 - marked.size);
      if (fullHouseNeeded < minFullHouseNeeded) minFullHouseNeeded = fullHouseNeeded;

      // Row 0
      const row0Nums = t.grid[0].filter((n) => n > 0);
      const row0Needed = row0Nums.filter((n) => !marked.has(n)).length;
      if (row0Needed < minTopLineNeeded) minTopLineNeeded = row0Needed;

      // Row 1
      const row1Nums = t.grid[1].filter((n) => n > 0);
      const row1Needed = row1Nums.filter((n) => !marked.has(n)).length;
      if (row1Needed < minMidLineNeeded) minMidLineNeeded = row1Needed;

      // Row 2
      const row2Nums = t.grid[2].filter((n) => n > 0);
      const row2Needed = row2Nums.filter((n) => !marked.has(n)).length;
      if (row2Needed < minBotLineNeeded) minBotLineNeeded = row2Needed;
    }

    return {
      early5: minEarly5Needed,
      topLine: minTopLineNeeded,
      midLine: minMidLineNeeded,
      botLine: minBotLineNeeded,
      fullHouse: minFullHouseNeeded,
    };
  }, [state?.tickets]);

  function handleClaim(prizeName: string, needed: number) {
    if (needed === 0) {
      setClaimToast(`🎉 BINGO! You claimed ${prizeName}! Host notified.`);
    } else {
      setClaimToast(`Cannot claim ${prizeName} yet (${needed} more number${needed > 1 ? "s" : ""} needed)`);
    }
  }

  if (!state) {
    return (
      <main className="container" style={{ textAlign: "center", paddingTop: 80 }}>
        <div style={{ display: "inline-block", padding: 24, background: "var(--surface-container)", borderRadius: 16 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 36, color: "var(--primary)", animation: "spin 1.5s linear infinite" }}>
            sync
          </span>
          <p className="muted" style={{ marginTop: 12 }}>Connecting to Tambola Player Arena...</p>
        </div>
      </main>
    );
  }

  const { game, player, tickets } = state;
  const previousBall = game.called.length > 1 ? game.called[game.called.length - 2] : null;

  // Filter visible tickets based on view mode
  const displayedTickets =
    viewMode === "single" && tickets[selectedTicketIndex]
      ? [tickets[selectedTicketIndex]]
      : tickets;

  return (
    <main className="container">
      {/* Toast Notification */}
      {claimToast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            background: "var(--surface-lowest)",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 12,
            border: "2px solid var(--primary-container)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(161,0,255,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-title)",
            fontWeight: 600,
          }}
        >
          <span className="material-symbols-outlined" style={{ color: "var(--tertiary)" }}>
            check_circle
          </span>
          {claimToast}
        </div>
      )}

      {/* TOP APP BAR */}
      <header className="topbar">
        {/* Brand & Player ID */}
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
            <span
              style={{
                fontFamily: "var(--font-title)",
                fontSize: "1.2rem",
                fontWeight: 800,
                letterSpacing: "0.08em",
                color: "var(--primary)",
                textTransform: "uppercase",
                display: "block",
                lineHeight: 1.1,
              }}
            >
              Tambola Arena
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "var(--tertiary)",
                  boxShadow: "0 0 8px var(--tertiary)",
                }}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--on-surface-variant)", fontWeight: 500 }}>
                Hi {player.name} &bull; ID: <b style={{ color: "var(--on-surface)" }}>{player.userId}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Voice Audio Toggle */}
          <button
            type="button"
            className="btn secondary small"
            style={{ display: "flex", alignItems: "center", gap: 8 }}
            onClick={() => setVoice(!voice)}
            title={voice ? "Voice Announcement Active" : "Voice Announcement Muted"}
          >
            <span
              className="material-symbols-outlined"
              style={{ color: voice ? "var(--tertiary)" : "var(--outline)", fontSize: 18 }}
            >
              {voice ? "volume_up" : "volume_off"}
            </span>
            <span style={{ fontFamily: "var(--font-title)", fontSize: "0.78rem", fontWeight: 700 }}>
              {voice ? "Voice Audio" : "Muted"}
            </span>
            {voice && (
              <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 14 }}>
                <span className="eq-bar" />
                <span className="eq-bar" />
                <span className="eq-bar" />
              </span>
            )}
          </button>

          {/* Live Status Pill */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              background: "var(--surface-high)",
              border: "1px solid rgba(78, 66, 86, 0.4)",
              borderRadius: 999,
              fontSize: "0.72rem",
              fontFamily: "var(--font-title)",
              fontWeight: 700,
              color: "var(--tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--tertiary)" }} />
            Live Event
          </div>

          {/* Logout */}
          <button
            type="button"
            className="btn secondary small"
            onClick={logout}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>
            <span style={{ display: "none" }}>Log out</span>
          </button>
        </div>
      </header>

      {/* HERO GAME TELEMETRY BANNER */}
      <section className="hero-banner">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          {/* Active Ball Sphere & Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
            {/* Luminous Ball Orb */}
            <div className="ball-glow-wrap">
              <div
                className="calling-pulse"
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  background: "rgba(161, 0, 255, 0.35)",
                  filter: "blur(8px)",
                }}
              />
              <div className={`ball${pop ? " pop" : ""}`}>
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
                <span>{game.current ?? "--"}</span>
              </div>
            </div>

            {/* Announcement Telemetry Details */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "2px 10px",
                  borderRadius: 999,
                  background: "rgba(161, 0, 255, 0.25)",
                  border: "1px solid rgba(161, 0, 255, 0.45)",
                  marginBottom: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>
                  campaign
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-title)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--primary)",
                  }}
                >
                  {game.status === "waiting" && "Game Starting Soon"}
                  {game.status === "running" && "Number Called!"}
                  {game.status === "finished" && "Game Finished"}
                </span>
              </div>

              <h2 style={{ fontSize: "1.6rem", margin: "2px 0 6px", fontWeight: 800 }}>
                {game.status === "waiting" && "Waiting for host to call first number..."}
                {game.status === "running" && (game.current ? `Number ${game.current} Announced` : "Game in progress")}
                {game.status === "finished" && "Game Over. Thank you for playing!"}
              </h2>

              <p className="muted" style={{ margin: 0, display: "flex", alignItems: "center", gap: 10, fontSize: "0.88rem" }}>
                <span>
                  <strong style={{ color: "var(--tertiary)", fontWeight: 700 }}>{game.called.length}</strong> of 90 numbers called
                </span>
                <span style={{ color: "var(--outline-variant)" }}>&bull;</span>
                <span style={{ color: "var(--primary)" }}>{90 - game.called.length} balls remaining</span>
              </p>
            </div>
          </div>

          {/* Previous Ball & Quick Auto-Dab */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            {/* Previous Ball Display */}
            {previousBall !== null && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(17, 8, 38, 0.75)",
                  padding: "8px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(78, 66, 86, 0.4)",
                }}
              >
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--on-surface-variant)", textTransform: "uppercase", display: "block", fontWeight: 600 }}>
                    Previous
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--on-surface)" }}>
                    Ball Called
                  </span>
                </div>
                <div className="chip" style={{ width: 38, height: 38, fontSize: "1rem" }}>
                  {previousBall}
                </div>
              </div>
            )}

            {/* Auto-Dab All Action */}
            <button
              type="button"
              className="btn accent"
              onClick={handleDabAll}
              disabled={dabAllBusy || game.called.length === 0}
              title="Automatically dab all called numbers across your tickets"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                auto_awesome
              </span>
              <span>{dabAllBusy ? "Dabbing..." : "Dab All"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* QUICK PRIZE TRACKER STRIP */}
      {prizeStatus && (
        <section>
          <div className="prize-tracker">
            {/* Early Five */}
            <div className={`prize-card${prizeStatus.early5 === 0 ? " highlight" : ""}`}>
              <div className="title-row">
                <span>Early Five</span>
                <span style={{ color: "var(--tertiary)" }}>₹1,500</span>
              </div>
              <div className="action-row">
                <span className={`needed${prizeStatus.early5 === 0 ? " done" : ""}`}>
                  {prizeStatus.early5 === 0 ? "Ready!" : `${prizeStatus.early5} Needed`}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                  onClick={() => handleClaim("Early Five", prizeStatus.early5)}
                >
                  Claim
                </button>
              </div>
            </div>

            {/* Top Line */}
            <div className={`prize-card${prizeStatus.topLine === 0 ? " highlight" : ""}`}>
              <div className="title-row">
                <span>Top Line</span>
                <span style={{ color: "var(--tertiary)" }}>₹2,000</span>
              </div>
              <div className="action-row">
                <span className={`needed${prizeStatus.topLine === 0 ? " done" : ""}`}>
                  {prizeStatus.topLine === 0 ? "Ready!" : `${prizeStatus.topLine} Needed`}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                  onClick={() => handleClaim("Top Line", prizeStatus.topLine)}
                >
                  Claim
                </button>
              </div>
            </div>

            {/* Middle Line */}
            <div className={`prize-card${prizeStatus.midLine === 0 ? " highlight" : ""}`}>
              <div className="title-row">
                <span>Middle Line</span>
                <span style={{ color: "var(--tertiary)" }}>₹2,000</span>
              </div>
              <div className="action-row">
                <span className={`needed${prizeStatus.midLine === 0 ? " done" : ""}`}>
                  {prizeStatus.midLine === 0 ? "Ready!" : `${prizeStatus.midLine} Needed`}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                  onClick={() => handleClaim("Middle Line", prizeStatus.midLine)}
                >
                  Claim
                </button>
              </div>
            </div>

            {/* Bottom Line */}
            <div className={`prize-card${prizeStatus.botLine === 0 ? " highlight" : ""}`}>
              <div className="title-row">
                <span>Bottom Line</span>
                <span style={{ color: "var(--tertiary)" }}>₹2,000</span>
              </div>
              <div className="action-row">
                <span className={`needed${prizeStatus.botLine === 0 ? " done" : ""}`}>
                  {prizeStatus.botLine === 0 ? "Ready!" : `${prizeStatus.botLine} Needed`}
                </span>
                <button
                  type="button"
                  className="btn secondary small"
                  style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                  onClick={() => handleClaim("Bottom Line", prizeStatus.botLine)}
                >
                  Claim
                </button>
              </div>
            </div>

            {/* Full House */}
            <div
              className="prize-card highlight"
              style={{
                background: "linear-gradient(135deg, rgba(161, 0, 255, 0.25), var(--surface-high))",
                borderColor: "rgba(161, 0, 255, 0.6)",
              }}
            >
              <div className="title-row">
                <span style={{ color: "var(--primary)" }}>Full House</span>
                <span style={{ color: "var(--tertiary)", fontWeight: 800 }}>₹10,000</span>
              </div>
              <div className="action-row">
                <span className={`needed${prizeStatus.fullHouse === 0 ? " done" : ""}`} style={{ color: "var(--tertiary)" }}>
                  {prizeStatus.fullHouse === 0 ? "Ready!" : `${prizeStatus.fullHouse} Needed`}
                </span>
                <button
                  type="button"
                  className="btn small"
                  style={{ padding: "3px 10px", fontSize: "0.72rem" }}
                  onClick={() => handleClaim("Full House", prizeStatus.fullHouse)}
                >
                  Claim
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {err && <div className="error">{err}</div>}

      {/* TICKET SELECTOR & VIEW CONTROLS */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 24,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ fontSize: "1.4rem", margin: 0 }}>
            Your Tickets ({tickets.length})
          </h2>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "var(--surface-high)",
              border: "1px solid rgba(78, 66, 86, 0.4)",
              fontSize: "0.75rem",
              fontFamily: "var(--font-title)",
              color: "var(--primary)",
            }}
          >
            Game ID: #{game.called.length > 0 ? "TMB-ACTIVE" : "TMB-PRE"}
          </span>
        </div>

        {/* View Layout Tabs */}
        <div
          style={{
            display: "inline-flex",
            padding: 3,
            background: "var(--surface-lowest)",
            borderRadius: 10,
            border: "1px solid rgba(78, 66, 86, 0.4)",
          }}
        >
          <button
            type="button"
            className="btn small"
            style={{
              padding: "4px 12px",
              fontSize: "0.78rem",
              background: viewMode === "all" ? "var(--primary-container)" : "transparent",
              color: viewMode === "all" ? "#fff" : "var(--on-surface-variant)",
              boxShadow: "none",
            }}
            onClick={() => setViewMode("all")}
          >
            Viewing {tickets.length} Tickets
          </button>
          <button
            type="button"
            className="btn small"
            style={{
              padding: "4px 12px",
              fontSize: "0.78rem",
              background: viewMode === "single" ? "var(--primary-container)" : "transparent",
              color: viewMode === "single" ? "#fff" : "var(--on-surface-variant)",
              boxShadow: "none",
            }}
            onClick={() => setViewMode("single")}
          >
            Focused View
          </button>
        </div>
      </div>

      {/* Single Ticket Selector Tabs (if single view active) */}
      {viewMode === "single" && tickets.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {tickets.map((t, idx) => (
            <button
              key={t.id}
              type="button"
              className="btn secondary small"
              style={{
                borderColor: selectedTicketIndex === idx ? "var(--primary)" : "var(--outline-variant)",
                background: selectedTicketIndex === idx ? "rgba(161, 0, 255, 0.2)" : "var(--surface-low)",
                color: selectedTicketIndex === idx ? "#fff" : "var(--on-surface-variant)",
              }}
              onClick={() => setSelectedTicketIndex(idx)}
            >
              Ticket {t.ticketNo}
            </button>
          ))}
        </div>
      )}

      {/* TICKETS CARDS GRID */}
      <div className="tickets">
        {displayedTickets.map((t) => {
          const marked = new Set(t.marked);
          const full = marked.size === 15;
          const hasCurrentMatch =
            game.current !== null &&
            !marked.has(game.current) &&
            t.grid.some((row) => row.includes(game.current!));

          return (
            <div
              key={t.id}
              className={`ticket${full ? " full" : ""}${hasCurrentMatch ? " match-alert" : ""}`}
            >
              {/* Ticket Header */}
              <header>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: hasCurrentMatch
                        ? "var(--primary-container)"
                        : full
                        ? "var(--tertiary)"
                        : "var(--gold)",
                      boxShadow: hasCurrentMatch ? "0 0 8px var(--primary-container)" : "none",
                    }}
                  />
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                    Ticket {t.ticketNo}
                  </span>
                  {hasCurrentMatch && (
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: 4,
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        background: "var(--primary-container)",
                        color: "#fff",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      Match!
                    </span>
                  )}
                </div>

                <div>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: full
                        ? "rgba(0, 226, 144, 0.2)"
                        : hasCurrentMatch
                        ? "rgba(161, 0, 255, 0.2)"
                        : "rgba(245, 158, 11, 0.15)",
                      color: full
                        ? "var(--tertiary)"
                        : hasCurrentMatch
                        ? "var(--primary)"
                        : "var(--gold)",
                      border: `1px solid ${
                        full
                          ? "rgba(0, 226, 144, 0.4)"
                          : hasCurrentMatch
                          ? "rgba(161, 0, 255, 0.4)"
                          : "rgba(245, 158, 11, 0.3)"
                      }`,
                    }}
                  >
                    {full ? "FULL HOUSE!" : `${marked.size}/15 Crossed`}
                  </span>
                </div>
              </header>

              {/* 3x9 Ticket Matrix */}
              <div className="ticket-grid-wrap">
                <table>
                  <tbody>
                    {t.grid.map((row, r) => (
                      <tr key={r}>
                        {row.map((n, c) => {
                          if (n === 0) {
                            return <td key={c} className="tcell blank" />;
                          }
                          const isMarked = marked.has(n);
                          const isCurrentMatch = n === game.current && !isMarked;

                          return (
                            <td
                              key={c}
                              className={`tcell num${isMarked ? " marked" : ""}${
                                isCurrentMatch ? " match-pulse" : ""
                              }`}
                              onClick={() => !isMarked && mark(t.id, n)}
                              title={
                                isMarked
                                  ? `Number ${n} (Dabbed)`
                                  : isCurrentMatch
                                  ? `Number ${n} (Active Ball - Tap to dab!)`
                                  : `Tap to mark ${n}`
                              }
                            >
                              {n}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Ticket Footer */}
              <footer>
                <span>Serial: #ACC-TK-{t.ticketNo.toString().padStart(3, "0")}</span>
                <span style={{ color: "var(--tertiary)" }}>
                  {15 - marked.size} left for Full House
                </span>
              </footer>
            </div>
          );
        })}
      </div>

      {/* CALLED NUMBERS MASTER BOARD */}
      <h2 style={{ marginTop: 32, marginBottom: 14 }}>authoritative Called Board</h2>
      <section className="panel">
        <NumberBoard called={game.called} current={game.current} />
      </section>

      {/* "ACHA ACHA ACHAAA!" BOGUS CLAIM POPUP */}
      {popup && (
        <div className="popup-backdrop" onClick={() => setPopup(false)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <div className="emoji">🙈</div>
            <div className="big">Acha Acha Achaaa!</div>
            <p className="muted" style={{ fontSize: "1rem", margin: "8px 0 16px" }}>
              That number hasn&apos;t been called yet. Wait for the host to announce it!
            </p>
            <button type="button" className="btn small" onClick={() => setPopup(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
