"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/client";

export default function PlayerLoginForm() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(targetId: string) {
    const trimmed = targetId.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: trimmed }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Login failed");
    setToken("player", data.token);
    router.push("/play");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    handleLogin(userId);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="uid">Your User ID (from email)</label>
        <div style={{ position: "relative" }}>
          <input
            id="uid"
            placeholder="e.g. acc001"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            style={{ paddingLeft: 42, fontFamily: "var(--font-title)", letterSpacing: "0.05em", fontWeight: 600 }}
            required
          />
          <span
            className="material-symbols-outlined"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--outline)",
            }}
          >
            badge
          </span>
        </div>
      </div>

      {/* Quick Demo Credential Pills */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--on-surface-variant)", marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
          Quick Demo Login:
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["acc001", "acc002", "acc003"].map((id) => (
            <button
              key={id}
              type="button"
              className="btn secondary small"
              style={{ padding: "4px 10px", fontSize: "0.78rem", fontFamily: "var(--font-title)" }}
              onClick={() => {
                setUserId(id);
                handleLogin(id);
              }}
              disabled={busy}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_circle</span>
              {id}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? (
            <>
              <span className="material-symbols-outlined" style={{ animation: "spin 1s linear infinite" }}>sync</span>
              Connecting...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">login</span>
              Enter Player Arena
            </>
          )}
        </button>
      </div>

      {error && <div className="error">{error}</div>}
    </form>
  );
}
