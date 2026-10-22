import Link from "next/link";
import PlayerLoginForm from "@/components/PlayerLoginForm";

export default function Home() {
  const formUrl = process.env.NEXT_PUBLIC_GOOGLE_FORM_URL || "#";
  const price = process.env.NEXT_PUBLIC_TICKET_PRICE;

  return (
    <main className="container">
      <div style={{ textAlign: "center", margin: "24px 0" }}>
        <h1 className="title">TAMBOLA NIGHT</h1>
        <p className="muted">Live housie for the whole organisation. Grab your tickets and get ready to shout!</p>
      </div>

      <div className="steps">
        <div className="panel step">
          <div className="n">1</div>
          <b>Buy tickets</b>
          <p className="muted">Fill the Google Form with your details and payment screenshot. Choose 1 to 3 tickets{price ? ` (Rs. ${price} each)` : ""}.</p>
        </div>
        <div className="panel step">
          <div className="n">2</div>
          <b>Get your User ID</b>
          <p className="muted">After we verify your payment, your tickets and unique User ID are emailed to you.</p>
        </div>
        <div className="panel step">
          <div className="n">3</div>
          <b>Play live</b>
          <p className="muted">Log in on game day, then tap numbers on your tickets as they are called.</p>
        </div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <section className="panel">
          <h2>Want tickets?</h2>
          <p className="muted">Submit the registration form to get your tickets by email.</p>
          <a className="btn" href={formUrl} target="_blank" rel="noopener noreferrer">Open registration form</a>
        </section>

        <section className="panel">
          <h2>Already have a User ID?</h2>
          <PlayerLoginForm />
        </section>
      </div>

      <p style={{ textAlign: "center", marginTop: 40 }}>
        <Link href="/admin" className="muted">Admin login</Link>
      </p>
    </main>
  );
}
