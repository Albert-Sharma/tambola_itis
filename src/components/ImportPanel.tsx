"use client";

import { useState } from "react";
import type { ImportRow, Mapping } from "@/lib/importSheet";
import { apiFetch } from "@/lib/client";

type Preview = { headers: string[]; mapping: Mapping; rows: ImportRow[] };
type Result = { status: "ok" | "nomail" | "error"; text: string };

export default function ImportPanel({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<Record<number, Result>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  async function parse(f: File, mapping?: Mapping) {
    setError("");
    setResults({});
    const fd = new FormData();
    fd.append("file", f);
    if (mapping) {
      fd.append("emailCol", String(mapping.email));
      fd.append("nameCol", String(mapping.name));
      fd.append("phoneCol", String(mapping.phone));
      fd.append("ticketCol", String(mapping.tickets));
    }
    const res = await apiFetch("admin", "/api/admin/import", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPreview(null);
      return setError(data.error || "Could not read the file");
    }
    const p = data as Preview;
    setPreview(p);
    setSelected(new Set(p.rows.filter((r) => !r.issue).map((r) => r.rowNo)));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(null);
    if (f) await parse(f);
  }

  function setCol(key: keyof Mapping, value: number) {
    if (!file || !preview) return;
    parse(file, { ...preview.mapping, [key]: value });
  }

  function toggle(rowNo: number) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(rowNo)) n.delete(rowNo);
      else n.add(rowNo);
      return n;
    });
  }

  async function runImport() {
    if (!preview) return;
    const todo = preview.rows.filter((r) => selected.has(r.rowNo) && !r.issue);
    setBusy(true);
    setError("");
    const out: Record<number, Result> = {};
    for (let i = 0; i < todo.length; i++) {
      const r = todo[i];
      setProgress(`Processing ${i + 1} of ${todo.length}...`);
      try {
        const res = await apiFetch("admin", "/api/admin/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: r.name, email: r.email, phone: r.phone, numTickets: r.numTickets }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) out[r.rowNo] = { status: "error", text: d.error || "Failed" };
        else if (d.emailSent) out[r.rowNo] = { status: "ok", text: `${d.userId} - emailed` };
        else out[r.rowNo] = { status: "nomail", text: `${d.userId} - created, email failed (${d.emailError})` };
      } catch {
        out[r.rowNo] = { status: "error", text: "Network error" };
      }
      setResults({ ...out });
    }
    setProgress("");
    setBusy(false);
    setSelected(new Set());
    onDone();
  }

  const h = preview?.headers ?? [];
  const select = (label: string, key: keyof Mapping, optional: boolean) => (
    <div>
      <label>{label}</label>
      <select value={preview?.mapping[key] ?? -1} onChange={(e) => setCol(key, Number(e.target.value))} disabled={busy}>
        <option value={-1}>{optional ? "(none)" : "-- choose column --"}</option>
        {h.map((x, i) => (
          <option key={i} value={i}>{x || `Column ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );

  const done = Object.keys(results).length > 0;

  return (
    <section className="panel" style={{ marginTop: 16 }}>
      <h2>Import from Google Form sheet</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        In Google Forms open Responses, then Link to Sheets, then File &gt; Download as .xlsx (or .csv). Upload it here. The e-mail and number-of-tickets
        columns are detected automatically; you can fix them below. Check the payment screenshots first and untick anyone who has not paid.
      </p>
      <input type="file" accept=".xlsx,.csv" onChange={onFile} disabled={busy} />
      {error && <div className="error">{error}</div>}

      {preview && (
        <>
          <div className="row" style={{ marginTop: 8 }}>
            {select("E-mail column", "email", false)}
            {select("Tickets column", "tickets", false)}
            {select("Name column", "name", true)}
            {select("Phone column", "phone", true)}
          </div>

          <div className="table-wrap" style={{ marginTop: 12, maxHeight: 360, overflowY: "auto" }}>
            <table className="list">
              <thead>
                <tr><th /><th>Row</th><th>Name</th><th>E-mail</th><th>Tickets</th><th>Status</th></tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => {
                  const res = results[r.rowNo];
                  return (
                    <tr key={r.rowNo}>
                      <td>
                        <input
                          type="checkbox"
                          style={{ width: "auto" }}
                          checked={selected.has(r.rowNo)}
                          disabled={busy || Boolean(r.issue) || Boolean(res)}
                          onChange={() => toggle(r.rowNo)}
                        />
                      </td>
                      <td>{r.rowNo}</td>
                      <td>{r.name}</td>
                      <td>{r.email}</td>
                      <td>{r.numTickets || "-"}</td>
                      <td>
                        {res ? (
                          <span className={`tag ${res.status === "ok" ? "good" : "bad"}`}>{res.text}</span>
                        ) : r.issue ? (
                          <span className="tag bad">{r.issue}</span>
                        ) : (
                          <span className="tag good">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row nofill" style={{ marginTop: 14 }}>
            <button className="btn" onClick={runImport} disabled={busy || selected.size === 0}>
              {busy ? progress : `Create IDs & e-mail tickets (${selected.size})`}
            </button>
            {done && !busy && <span className="muted">Done. Failed e-mails can be resent from the Players table.</span>}
          </div>
        </>
      )}
    </section>
  );
}
