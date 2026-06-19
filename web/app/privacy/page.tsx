import type { Metadata } from "next";
import { Hero } from "@/components/ui";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "AssetFrame Privacy Policy — what we collect, why, our lawful bases, sub-processors, and your rights under UK GDPR.",
  alternates: { canonical: "/privacy" },
};

const UPDATED = "16 June 2026";

function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-navy">{title}</h2>
      <div className="mt-1 space-y-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

const PROCESSORS = [
  ["Clerk", "Authentication & account management", "USA"],
  // TODO(copy): billing migrated to Clerk Billing (Stripe is the payment processor / MoR);
  // this sub-processor row + the Lemon Squeezy mentions in the body are handled in the copy pass.
  ["Lemon Squeezy", "Payments & subscriptions (merchant of record), invoicing & tax", "USA"],
  ["Neon", "Database — accounts, subscription status, watchlists, follows, report catalogue & track record", "EU (London region)"],
  ["Cloudflare", "Private Pro-file storage (R2) & content delivery", "Global edge"],
  ["Vercel", "Website hosting & privacy-friendly product analytics", "USA / global edge"],
  ["Google Analytics", "Optional usage analytics — only with your consent", "USA"],
  ["Google (Places)", "Displaying business reviews & ratings", "USA"],
  ["Resend", "Transactional & newsletter email delivery", "USA"],
];

export default function PrivacyPage() {
  return (
    <>
      <Hero title="Privacy Policy" tag="What we collect, why, and your rights." />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-muted-foreground">
          Last updated: {UPDATED}. This policy explains how {SITE.brand} collects and uses your personal
          data, and your rights under the UK GDPR and the Data Protection Act 2018.
        </p>

        <Clause title="Who we are (controller)">
          <p>{SITE.brand} is the <b>data controller</b> for personal data processed through this site. For any privacy question, or to exercise your rights, contact us at <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>. Where we act as controller, the providers listed in the sub-processors table below act as our <b>processors</b> (or, for payments, as an independent controller / merchant of record).</p>
        </Clause>

        <Clause title="What we collect">
          <p>We keep what we need to run the service, and no more:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li><b>Account data</b> — your email address, name (if provided), and authentication details, handled by our identity provider, Clerk.</li>
            <li><b>Billing data</b> — whether you have an active {SITE.brand} Pro subscription and the related billing identifiers we receive from Lemon Squeezy, our merchant of record. Lemon Squeezy handles your payment and never passes us your full card details — <b>we never see or store card numbers</b>.</li>
            <li><b>Usage &amp; analytics data</b> — privacy-friendly, aggregated analytics about how the site is used and performs, and (only with your consent) Google Analytics measurement.</li>
            <li><b>Web-push subscription data</b> — if you enable browser notifications, the push subscription endpoint and keys your browser generates, so we can send you alerts. We do not receive your identity from this beyond what you have already given us.</li>
            <li><b>Newsletter email</b> — if you subscribe, your email address, captured with <b>double opt-in</b> (we send a confirmation link and only add you once you confirm), plus your subscription status and unsubscribe events.</li>
            <li><b>Feedback &amp; support correspondence</b> — messages, ratings, and feedback you send us.</li>
            <li><b>Watchlists &amp; follows</b> — the instruments or reports you choose to save or follow, so we can tailor what we show and notify you about.</li>
            <li><b>IP address &amp; logs</b> — standard server/CDN log data (such as IP address, device/browser type, timestamps, and request details) used to deliver, secure, and debug the service.</li>
          </ul>
        </Clause>

        <Clause title="How we use it, and our lawful bases">
          <p>We process your data for the purposes below, and we rely on the lawful basis shown for each under UK GDPR:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li><b>Create and secure your account; deliver the reports you are entitled to; process subscriptions and payments</b> — <i>performance of a contract</i> with you (and <i>legal obligation</i> for tax/invoicing records).</li>
            <li><b>Provide support and respond to your feedback</b> — <i>performance of a contract</i> and our <i>legitimate interests</i> in helping users and improving the service.</li>
            <li><b>Operate watchlists and follows, and send related product/web-push notifications</b> — <i>performance of a contract</i> (delivering features you ask for), with web-push enabled only on your <i>consent</i> via your browser.</li>
            <li><b>Send the newsletter</b> — your <i>consent</i> (double opt-in), which you can withdraw at any time by unsubscribing.</li>
            <li><b>Secure the service, prevent fraud and abuse, debug, and keep logs</b> — our <i>legitimate interests</i> in running a safe, reliable service.</li>
            <li><b>Optional analytics cookies (Google Analytics)</b> — your <i>consent</i>, given through the cookie banner.</li>
            <li><b>Privacy-friendly, cookieless measurement</b> — our <i>legitimate interests</i> in understanding aggregate traffic and performance without identifying you.</li>
            <li><b>Meet legal and regulatory obligations</b> — <i>legal obligation</i>.</li>
          </ul>
          <p>Where we rely on legitimate interests, we have balanced those interests against your rights and consider the processing proportionate. You can object to legitimate-interests processing at any time (see &ldquo;Your rights&rdquo;).</p>
        </Clause>

        <Clause title="Who we share it with (sub-processors)">
          <p>We share data only with the providers that run {SITE.brand}, each under their own data-protection terms and only as needed for the purposes above. <b>We do not sell your personal data</b> and we do not share it for third-party advertising. Some of these providers process data <b>outside the UK</b>; where they do, the transfer is protected by an appropriate safeguard (see &ldquo;International transfers&rdquo;).</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full overflow-hidden rounded-xl border border-line bg-white text-sm">
              <thead className="bg-tile text-navy">
                <tr><th className="p-3 text-left">Provider</th><th className="p-3 text-left">Purpose</th><th className="p-3 text-left">Location</th></tr>
              </thead>
              <tbody>
                {PROCESSORS.map(([name, purpose, loc]) => (
                  <tr key={name} className="border-t border-line">
                    <td className="p-3 font-semibold">{name}</td><td className="p-3">{purpose}</td><td className="p-3 text-muted-foreground">{loc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">We may also disclose data where required by law, to enforce our terms, or to protect our rights, users, or the public.</p>
        </Clause>

        <Clause title="Cookies & consent">
          <p><b>Strictly necessary cookies</b> — authentication and session cookies set by Clerk when you sign in. These are essential to log you in and need no consent.</p>
          <p><b>Cookieless measurement</b> — our default traffic and performance measurement (Vercel Web Analytics and Speed Insights) does not use cookies and does not identify you.</p>
          <p><b>Analytics cookies (Google Analytics)</b> — these are <b>consent-gated</b> and load <b>only after you accept</b> the cookie banner. If you choose Reject, no Google Analytics cookies are set. We store your banner choice in your browser&apos;s local storage so we don&apos;t ask again; you can change your mind by clearing that choice or adjusting your browser settings.</p>
        </Clause>

        <Clause title="Web-push notifications">
          <p>If you opt in, your browser creates a <b>push subscription</b> (an endpoint plus encryption keys) which we store so we can send you alerts about reports, watchlists, or follows. We use this only to deliver notifications you have asked for.</p>
          <p>You can <b>revoke push notifications at any time</b> — either in your browser&apos;s site-notification settings, or from your <a className="text-navy underline" href="/account">account</a>. Revoking stops further notifications and invalidates the stored subscription.</p>
        </Clause>

        <Clause title="How long we keep it">
          <p>We keep account, watchlist, and follow data while your account is active and for a reasonable period afterwards, then delete or anonymise it. Subscription and billing/tax records are retained by our merchant of record for as long as the law requires. Newsletter data is kept until you unsubscribe (plus a short suppression record so we don&apos;t re-add you). Web-push subscriptions are kept until you revoke them or they expire. Server and analytics logs are kept only for a short period for security and operational purposes.</p>
        </Clause>

        <Clause title="Your rights">
          <p>Under UK GDPR you have the right to: <b>access</b> your data; <b>rectify</b> inaccurate data; <b>erase</b> your data (&ldquo;right to be forgotten&rdquo;); request <b>portability</b> of data you gave us; <b>restrict</b> processing; <b>object</b> to processing based on legitimate interests; and <b>withdraw consent</b> at any time (for example, by unsubscribing from the newsletter or disabling web-push), without affecting processing carried out before withdrawal.</p>
          <p>Email <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> to exercise any of these and we will respond within the statutory time limit (normally one month). You also have the <b>right to complain to the UK Information Commissioner&apos;s Office (ICO)</b> at <a className="text-navy underline" href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer">ico.org.uk</a> if you are unhappy with how we handle your data — though we&apos;d appreciate the chance to put things right first.</p>
        </Clause>

        <Clause title="Security">
          <p>Access to your account and to paid content is protected by authentication and short-lived, signed download links. Data is encrypted in transit, access is restricted, and we apply reasonable technical and organisational measures appropriate to the risk. No system is perfectly secure, but we work to protect your data and to notify you and the ICO of any breach where the law requires.</p>
        </Clause>

        <Clause title="International transfers">
          <p>Some of our providers process data outside the UK (for example, in the United States). Where they do, the transfer is protected by an appropriate safeguard recognised under UK law — such as an <b>adequacy decision</b>, the <b>UK International Data Transfer Agreement (IDTA)</b> or the EU <b>Standard Contractual Clauses</b> with the UK Addendum, or the UK extension to the EU–US Data Privacy Framework — together with any additional measures required to protect your data.</p>
        </Clause>

        <Clause title="Children">
          <p>{SITE.brand} is not intended for anyone under 18, and we do not knowingly collect data from children. If you believe a child has given us personal data, contact us and we will delete it.</p>
        </Clause>

        <Clause title="Changes to this policy">
          <p>We may update this policy from time to time. Material changes will be reflected by the <b>&ldquo;last updated&rdquo;</b> date above; significant changes affecting your rights will be brought to your attention.</p>
        </Clause>

        <Clause title="Contact">
          <p>For any privacy question, or to exercise your rights, contact <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.</p>
        </Clause>
      </div>
    </>
  );
}
