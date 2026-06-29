import "server-only";
import { Resend } from "resend";
import { SITE } from "@/site.config";

// Transactional email via Resend. Disabled gracefully when RESEND_API_KEY is absent
// (sendEmail returns {ok:false, skipped:true}) so the app builds/runs without it.
const apiKey = process.env.RESEND_API_KEY || "";
// Must be a verified sender on the Resend account. Until the domain is verified, Resend's
// shared 'onboarding@resend.dev' only delivers to the account owner — set RESEND_FROM in prod.
const FROM = process.env.RESEND_FROM || "AssetFrame <onboarding@resend.dev>";

export const emailConfigured = Boolean(apiKey);
const resend = apiKey ? new Resend(apiKey) : null;

export type SendResult =
  | { ok: true }
  | { ok: false; skipped?: true; error?: string };

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  // Extra SMTP headers (e.g. List-Unsubscribe / List-Unsubscribe-Post for one-click unsubscribe,
  // which improves deliverability and shows a native unsubscribe in Gmail/Outlook).
  headers?: Record<string, string>;
}): Promise<SendResult> {
  if (!resend) return { ok: false, skipped: true };
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
      headers: opts.headers,
    });
    if (error) return { ok: false, error: String((error as { message?: string }).message ?? error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Branded HTML shell shared by every email. `footerNote` lets per-message compliance text
// (e.g. an unsubscribe line) sit above the standing disclaimer.
export function emailShell(opts: { heading: string; bodyHtml: string; footerNote?: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2730;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="font-weight:800;font-size:18px;color:#0b2545;margin-bottom:16px;">${esc(SITE.brand)}</div>
    <div style="background:#fff;border:1px solid #e6e8eb;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 12px;font-size:18px;color:#0b2545;">${esc(opts.heading)}</h1>
      ${opts.bodyHtml}
    </div>
    ${opts.footerNote ? `<p style="font-size:12px;color:#6b7280;margin:16px 4px 4px;">${opts.footerNote}</p>` : ""}
    <p style="font-size:11px;line-height:1.5;color:#9aa3ad;margin:12px 4px 0;">${esc(SITE.disclaimer)}</p>
  </div>
</body></html>`;
}

// Simple button used inside email bodies.
export function emailButton(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:#0b2545;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">${esc(label)}</a>`;
}
