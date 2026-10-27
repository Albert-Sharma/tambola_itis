export function NumberBoard({
  called,
  current,
  showLegend = true,
}: {
  called: number[];
  current: number | null;
  showLegend?: boolean;
}) {
  const set = new Set(called);
  return (
    <div>
      {showLegend && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: "1px solid rgba(78, 66, 86, 0.3)",
            fontSize: "0.8rem",
            fontFamily: "var(--font-title)",
          }}
        >
          <div style={{ color: "var(--on-surface-variant)", fontWeight: 600 }}>
            Master Matrix (1 - 90) &bull; <span style={{ color: "var(--tertiary)" }}>{called.length}/90 Called</span>
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "var(--primary-container)",
                  border: "1px solid #fff",
                }}
              />
              <span style={{ color: "#fff" }}>Current</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "var(--secondary-container)",
                  border: "1px solid var(--secondary)",
                }}
              />
              <span style={{ color: "var(--on-surface-variant)" }}>Called</span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: "var(--surface-container)",
                  border: "1px solid var(--outline-variant)",
                }}
              />
              <span style={{ color: "var(--outline)" }}>Uncalled</span>
            </span>
          </div>
        </div>
      )}

      <div className="board">
        {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
          <div
            key={n}
            className={`cell${set.has(n) ? " called" : ""}${n === current ? " current" : ""}`}
            title={`Number ${n}${n === current ? " (Current)" : set.has(n) ? " (Called)" : ""}`}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentNumbers({ called }: { called: number[] }) {
  const recent = called.slice(-6, -1).reverse();
  if (!recent.length) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          fontSize: "0.75rem",
          fontFamily: "var(--font-title)",
          color: "var(--on-surface-variant)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        Recent Balls
      </div>
      <div className="recent">
        {recent.map((n) => (
          <span key={n} className="chip">
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

export function announce(n: number) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const text = n < 10 ? `Number ${n}` : `${Math.floor(n / 10)} ${n % 10}, ${n}`;
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}
