import nodemailer from "nodemailer";

const SIGNATURE_NAME = "Knishka Khandelwal";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Registration confirmation: tells the player how many tickets they applied for and their in-game user-id. */
export async function sendRegistrationEmail(opts: {
  to: string;
  name: string;
  userId: string;
  numTickets: number;
}): Promise<{ sent: boolean; error?: string }> {
  const tickets = `${opts.numTickets} Tambola ticket${opts.numTickets === 1 ? "" : "s"}`;
  const text =
    `Hi ${opts.name},\n` +
    `You have successfully applied for ${tickets} and here is your in-game user-id : ${opts.userId}\n\n` +
    `Regards\n${SIGNATURE_NAME}\n`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">
<p>Hi ${esc(opts.name)},<br>
You have successfully applied for ${esc(tickets)} and here is your in-game user-id : <b>${esc(opts.userId)}</b></p>
<p>Regards<br>${esc(SIGNATURE_NAME)}</p>
</div>`;

  if (!mailConfigured()) {
    console.warn(`[mail] SMTP not configured. Would have sent registration mail to ${opts.to} (user ${opts.userId}).`);
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
    // Gmail only sends as the authenticated account (or a verified alias), so MAIL_FROM should match SMTP_USER.
    const from = process.env.MAIL_FROM || process.env.SMTP_USER;
    await transport.sendMail({
      from: `"Tambola" <${from}>`,
      to: opts.to,
      subject: `Your Tambola in-game user-id: ${opts.userId}`,
      text,
      html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[mail] send failed", e);
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
