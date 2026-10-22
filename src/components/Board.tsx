export function NumberBoard({ called, current }: { called: number[]; current: number | null }) {
  const set = new Set(called);
  return (
    <div className="board">
      {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => (
        <div key={n} className={`cell${set.has(n) ? " called" : ""}${n === current ? " current" : ""}`}>
          {n}
        </div>
      ))}
    </div>
  );
}

export function RecentNumbers({ called }: { called: number[] }) {
  const recent = called.slice(-6, -1).reverse();
  if (!recent.length) return null;
  return (
    <div>
      <div className="muted" style={{ marginBottom: 6 }}>Previous</div>
      <div className="recent">
        {recent.map((n) => (
          <span key={n} className="chip">{n}</span>
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
