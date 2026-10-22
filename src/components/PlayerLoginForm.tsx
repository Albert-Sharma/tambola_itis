"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/client";

export default function PlayerLoginForm() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(data.error || "Login failed");
    setToken("player", data.token);
    router.push("/play");
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="uid">Your User ID (from the email)</label>
      <input
        id="uid"
        placeholder="e.g. acc001"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        required
      />
      <div style={{ marginTop: 14 }}>
        <button className="btn" disabled={busy}>{busy ? "Checking..." : "Enter the game"}</button>
      </div>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
