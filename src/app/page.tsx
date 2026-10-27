import Link from "next/link";
import PlayerLoginForm from "@/components/PlayerLoginForm";

export default function Home() {
  const formUrl = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || "#";
  const price = process.env.NEXT_PUBLIC_TICKET_PRICE;

  return (
    <main className="container narrow" style={{ maxWidth: 840 }}>
      {/* Top App Bar */}
      <header className="topbar" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
            <span style={{ fontSize: "0.75rem", color: "var(--on-surface-variant)" }}>
              Accenture All-Hands Event
            </span>
          </div>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            background: "var(--surface-low)",
            border: "1px solid var(--outline-variant)",
            borderRadius: 999,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "var(--tertiary)",
              boxShadow: "0 0 10px var(--tertiary)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-title)",
              fontSize: "0.72rem",
              fontWeight: 700,
              color: "var(--tertiary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Live Event
          </span>
        </div>
      </header>

      {/* Hero Header Section */}
      <div style={{ textAlign: "center", margin: "28px 0 32px" }}>
        <h1 className="title" style={{ marginBottom: 6 }}>
          TAMBOLA NIGHT
        </h1>
        <div
          style={{
            height: 3,
            width: 90,
            margin: "0 auto 16px",
            background: "linear-gradient(90deg, transparent, var(--primary-container), transparent)",
            borderRadius: 99,
          }}
        />
        <p className="muted" style={{ maxWidth: 500, margin: "0 auto", fontSize: "1.05rem", lineHeight: 1.5 }}>
          Live housie for the whole organisation. Grab your tickets, dab numbers live, and shout for the win!
        </p>
      </div>

      {/* Bento 3-Step Progression Rail */}
      <div className="steps">
        <div className="step">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="n">1</div>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", opacity: 0.8 }}>
              receipt_long
            </span>
          </div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Buy tickets</h3>
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
            Fill the form with payment screenshot. Choose 1 to 3 tickets{price ? ` (Rs. ${price} each)` : ""}.
          </p>
        </div>

        <div className="step">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="n">2</div>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", opacity: 0.8 }}>
              mark_email_read
            </span>
          </div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Get your User ID</h3>
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
            Verified payment generates your unique User ID (<code style={{ color: "var(--tertiary)" }}>acc001</code>) and tickets.
          </p>
        </div>

        <div className="step">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="n">3</div>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)", opacity: 0.8 }}>
              celebration
            </span>
          </div>
          <h3 style={{ fontSize: "1.1rem", marginBottom: 6 }}>Play in Arena</h3>
          <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
            Log in on game day, dab numbers as they are called, and claim your prizes live.
          </p>
        </div>
      </div>

      {/* Action Panels Grid */}
      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 24 }}>
        <section className="panel" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
                shopping_bag
              </span>
              <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Need Tickets?</h2>
            </div>
            <p className="muted" style={{ marginBottom: 20 }}>
              Submit your registration form to get your tickets generated and sent to your email.
            </p>
          </div>
          <a className="btn secondary" href={formUrl} target="_blank" rel="noopener noreferrer" style={{ width: "100%" }}>
            <span className="material-symbols-outlined">open_in_new</span>
            Open Registration Form
          </a>
        </section>

        <section className="panel">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ color: "var(--primary)" }}>
              sports_score
            </span>
            <h2 style={{ fontSize: "1.3rem", margin: 0 }}>Have a User ID?</h2>
          </div>
          <PlayerLoginForm />
        </section>
      </div>

      {/* Footer Navigation */}
      <footer
        style={{
          marginTop: 48,
          paddingTop: 20,
          borderTop: "1px solid rgba(78, 66, 86, 0.3)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          fontSize: "0.85rem",
        }}
      >
        <span className="muted">Tambola Arena &bull; Accenture Live Game Night</span>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <Link href="/admin" className="muted" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>admin_panel_settings</span>
            Host Console
          </Link>
          <a href="/stitch/index.html" className="muted" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>design_services</span>
            Stitch Redesign Hub
          </a>
        </div>
      </footer>
    </main>
  );
}
