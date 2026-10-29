import { store } from "./store";
import { issueTickets } from "./game";
import { sendRegistrationEmail } from "./mailer";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates the player (gets the in-game user-id) and generates its unique tickets. Rolls back if tickets fail. */
export async function createPlayerWithTickets(input: {
  name: string;
  email: string;
  phone: string | null;
  numTickets: number;
}): Promise<{ id: string; user_id: string }> {
  const player = await store().createPlayer(input);
  try {
    await issueTickets(player.id, input.numTickets);
  } catch (e) {
    await store().deletePlayer(player.id);
    throw e;
  }
  return player;
}

/** Sends the registration e-mail and, only on success, ticks success_sent_email_1 for the player. */
export async function emailPlayer(player: {
  id: string;
  user_id: string;
  name: string;
  email: string;
  num_tickets: number;
}): Promise<{ sent: boolean; error?: string }> {
  const mail = await sendRegistrationEmail({
    to: player.email,
    name: player.name,
    userId: player.user_id,
    numTickets: player.num_tickets,
  });
  if (mail.sent) await store().markEmailSent(player.id);
  return mail;
}

export type FormRegistration = {
  status: "created" | "resent" | "already_sent" | "email_failed";
  userId: string;
  emailSent: boolean;
  emailError?: string;
};

async function registerOne(input: { name: string; email: string; numTickets: number }): Promise<FormRegistration> {
  const existing = await store().findPlayerByEmail(input.email);
  if (existing?.success_sent_email_1) {
    return { status: "already_sent", userId: existing.user_id, emailSent: true };
  }

  // Existing player whose mail failed earlier: just retry the mail. Otherwise register from scratch.
  const player =
    existing ??
    {
      ...(await createPlayerWithTickets({ name: input.name, email: input.email, phone: null, numTickets: input.numTickets })),
      name: input.name,
      email: input.email,
      num_tickets: input.numTickets,
    };
  const mail = await emailPlayer(player);
  return {
    status: mail.sent ? (existing ? "resent" : "created") : "email_failed",
    userId: player.user_id,
    emailSent: mail.sent,
    emailError: mail.error,
  };
}

const g = globalThis as { __tambolaRegQueue?: Promise<unknown> };

/**
 * Form submission -> player + unique tickets + e-mail + success_sent_email_1 tick.
 * Idempotent per e-mail address and serialized, so the webhook, the sheet poller and the admin
 * "Sync" button can run at the same time without creating duplicate players or duplicate mails.
 */
export function registerFromForm(input: { name: string; email: string; numTickets: number }): Promise<FormRegistration> {
  const run = (g.__tambolaRegQueue ?? Promise.resolve()).then(
    () => registerOne(input),
    () => registerOne(input)
  );
  g.__tambolaRegQueue = run.catch(() => undefined);
  return run;
}
