import type { AdminTitle, PlayerTitle } from "@/lib/titles";

const ordinal = (n: number) => (n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`);

/** One title card on the player's screen: live race position, then Claimed / Oops Missed once settled. */
export function PlayerPrizeCard({ t }: { t: PlayerTitle }) {
  const isFull = t.key === "full_house";
  const mine = t.claims.find((c) => c.mine);
  const pct = Math.round(((t.size - Math.min(t.needed, t.size)) / t.size) * 100);

  return (
    <div className={`prize-card ${t.state}${isFull ? " full-house" : ""}`}>
      <div className="title-row">
        <span style={isFull ? { color: "var(--primary)" } : undefined}>{t.label}</span>
        <span style={{ color: "var(--tertiary)", fontWeight: isFull ? 800 : 700 }}>{t.prize}</span>
      </div>

      {t.state === "claimed" && (
        <>
          <span className="prize-badge won">Claimed</span>
          <div className="prize-sub">
            {isFull
              ? `You hold winner ${mine?.position} of ${t.slots} (Ticket ${mine?.ticketNo})`
              : `You won this with Ticket ${mine?.ticketNo}`}
          </div>
          {isFull && t.slotsLeft > 0 && (
            <div className="prize-sub">
              {t.slotsLeft} slot{t.slotsLeft > 1 ? "s" : ""} still open to others
            </div>
          )}
        </>
      )}

      {t.state === "missed" && (
        <>
          <span className="prize-badge missed">Oops Missed</span>
          <div className="prize-sub">
            {isFull
              ? `All ${t.slots} Full House winners are in: ${t.claims.map((c) => c.name).join(", ")}`
              : `Claimed by ${t.claims[0]?.name ?? "another player"}`}
          </div>
        </>
      )}

      {t.state === "racing" && (
        <>
          <div className="action-row">
            <span className={`needed${t.needed === 0 ? " done" : ""}`}>
              {t.needed === 0 ? "Ready!" : `${t.needed} Needed`}
            </span>
            <span className="prize-rank" title="Your position among all players still racing for this title">
              #{t.rank} of {t.racers}
            </span>
          </div>
          <div className="prize-bar" aria-hidden="true">
            <span style={{ width: `${pct}%` }} />
          </div>
          <div className="prize-sub">
            {t.leaderNeeded === null
              ? "Open"
              : t.rank === 1
              ? t.racers > 1
                ? "You are leading the race"
                : "You are the only one racing"
              : `Leader needs ${t.leaderNeeded}`}
            {t.bestTicketNo !== null && t.needed > 0 ? ` • Ticket ${t.bestTicketNo}` : ""}
          </div>
          {isFull && t.claims.length > 0 && (
            <div className="prize-sub">
              {t.slotsLeft} of {t.slots} slots left &bull; won by {t.claims.map((c) => c.name).join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Host view: status of every title, who won it, and who is closest right now. */
export function AdminPrizeRace({ titles }: { titles: AdminTitle[] }) {
  return (
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="panel-header">
        <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Live Prize Race</h2>
        <span style={{ fontSize: "0.75rem", color: "var(--tertiary)", fontWeight: 700 }}>
          FIRST TO CROSS WINS
        </span>
      </div>

      <div className="admin-prizes">
        {titles.map((t) => {
          const isFull = t.key === "full_house";
          const closed = t.slotsLeft === 0;
          const taken = t.slots - t.slotsLeft;
          return (
            <div key={t.key} className={`prize-card ${closed ? "claimed" : "racing"}${isFull ? " full-house" : ""}`}>
              <div className="title-row">
                <span style={isFull ? { color: "var(--primary)" } : undefined}>{t.label}</span>
                <span style={{ color: "var(--tertiary)" }}>{t.prize}</span>
              </div>

              <div style={{ marginBottom: 8 }}>
                <span className={`prize-badge ${closed ? "won" : taken > 0 ? "partial" : "open"}`}>
                  {closed ? "Closed" : taken > 0 ? `Open (${taken}/${t.slots} claimed)` : "Open"}
                </span>
              </div>

              {t.claims.length > 0 && (
                <ul className="prize-list">
                  {t.claims.map((c) => (
                    <li key={c.position}>
                      <b>{isFull ? `${ordinal(c.position)} ` : "Winner "}</b>
                      {c.name} <span className="muted">({c.userId})</span>
                      <span className="muted">
                        {" "}
                        &bull; Ticket {c.ticketNo} &bull; ball #{c.atCall}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {!closed && (
                <>
                  <div className="prize-sub" style={{ marginTop: 6 }}>
                    Closest now{t.oneAway > 0 ? ` (${t.oneAway} ticket${t.oneAway > 1 ? "s" : ""} one number away)` : ""}
                  </div>
                  {t.contenders.length === 0 ? (
                    <div className="prize-sub">No tickets in play.</div>
                  ) : (
                    <ul className="prize-list">
                      {t.contenders.slice(0, 3).map((c, i) => (
                        <li key={`${c.userId}-${c.ticketNo}`}>
                          <b>#{i + 1}</b> {c.name} <span className="muted">({c.userId} &bull; T{c.ticketNo})</span>
                          <span style={{ float: "right", color: c.needed <= 1 ? "var(--tertiary)" : undefined, fontWeight: 700 }}>
                            {c.needed === 0 ? "Complete" : `needs ${c.needed}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
