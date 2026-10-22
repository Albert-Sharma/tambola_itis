import nodemailer from "nodemailer";
import type { Grid } from "./ticket";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function gridHtml(grid: Grid, label: string) {
  const rows = grid
    .map(
      (row) =>
        "<tr>" +
        row
          .map(
            (n) =>
              `<td style="width:38px;height:38px;text-align:center;border:1px solid #b45309;font:bold 16px Arial;background:${
                n ? "#fffbeb" : "#fde68a"
              };color:#7c2d12">${n || ""}</td>`
          )
          .join("") +
        "</tr>"
    )
    .join("");
  return `<p style="font:bold 14px Arial;margin:16px 0 6px">${esc(label)}</p>
<table style="border-collapse:collapse">${rows}</table>`;
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendTicketsEmail(opts: {
  to: string;
  name: string;
  userId: string;
  grids: Grid[];
}): Promise<{ sent: boolean; error?: string }> {
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const from = process.env.MAIL_FROM || "abcd@gmail.com";
  const html = `
<div style="font-family:Arial,sans-serif;max-width:520px">
  <h2 style="color:#b91c1c">Your Tambola tickets are ready!</h2>
  <p>Hi ${esc(opts.name)},</p>
  <p>Thank you for joining. Your unique <b>User ID</b> is:</p>
  <p style="font:bold 28px monospace;background:#fef3c7;padding:10px 16px;display:inline-block;border-radius:8px">${esc(
    opts.userId
  )}</p>
  <p>On game day, open <a href="${esc(appUrl)}">${esc(appUrl)}</a> and log in with this ID. Your tickets will appear on screen
  and you can cross numbers as they are called.</p>
  <h3>Your ${opts.grids.length} ticket${opts.grids.length > 1 ? "s" : ""}</h3>
  ${opts.grids.map((g, i) => gridHtml(g, `Ticket ${i + 1}`)).join("")}
  <p style="margin-top:24px;color:#78716c;font-size:12px">Keep your User ID private. Good luck!</p>
</div>`;

  if (!mailConfigured()) {
    console.warn(`[mail] SMTP not configured. Would have sent tickets to ${opts.to} (user ${opts.userId}).`);
    return { sent: false, error: "SMTP not configured" };
  }

  try {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: `"Tambola" <${from}>`,
      to: opts.to,
      subject: `Your Tambola User ID: ${opts.userId}`,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[mail] send failed", e);
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
