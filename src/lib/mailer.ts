import "server-only";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";

/**
 * SAFETY: the recipient is hardcoded from OUTREACH_TO (our own inbox). Prospect addresses are never used,
 * never fetched, and never passed to this function.
 */
export function outreachInbox(): string {
  const to = process.env.OUTREACH_TO;
  if (!to) throw new Error("OUTREACH_TO missing");
  return to;
}

export function mailTransport(): "gmail-api" | "gmail" | "resend" | "none" {
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) return "gmail-api";
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) return "gmail";
  if (process.env.RESEND_API_KEY) return "resend";
  return "none";
}

export async function sendOutreach(opts: { subject: string; text: string; html: string }) {
  const to = outreachInbox();
  const transport = mailTransport();
  if (transport === "gmail-api") {
    // OAuth refresh token saved by the gws CLI (`gws auth login -s gmail`, then `gws auth export`).
    const tok = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_CLIENT_ID!,
        client_secret: process.env.GMAIL_CLIENT_SECRET!,
        refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
        grant_type: "refresh_token",
      }),
    });
    const tj = await tok.json();
    if (!tok.ok) throw new Error(`Google token refresh failed: ${tj.error_description ?? tj.error}`);
    const raw = await new MailComposer({
      from: `Sprinto Outreach Bot <${process.env.GMAIL_USER || to}>`,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    })
      .compile()
      .build();
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${tj.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: raw.toString("base64url") }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Gmail API ${res.status}: ${json.error?.message ?? JSON.stringify(json).slice(0, 200)}`);
    return { id: json.id as string, transport, to };
  }
  if (transport === "gmail") {
    const t = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
    const info = await t.sendMail({
      from: `Sprinto Outreach Bot <${process.env.GMAIL_USER}>`,
      to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    return { id: info.messageId, transport, to };
  }
  if (transport === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Sprinto Outreach Bot <onboarding@resend.dev>",
        to: [to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    return { id: json.id as string, transport, to };
  }
  throw new Error("No mail transport configured (run gws auth login -s gmail and set GMAIL_CLIENT_ID/SECRET/REFRESH_TOKEN)");
}

/** Public pages never show the full inbox address. */
export function maskEmail(e: string) {
  const [u, d] = e.split("@");
  return `${u.slice(0, 2)}•••@${d}`;
}
