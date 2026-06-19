import type { Metadata } from "next";
import { Hero } from "@/components/ui";
import { SITE } from "@/site.config";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "AssetFrame Terms & Conditions — market research, not regulated advice; subscriptions, acceptable use, API terms, IP and liability.",
  alternates: { canonical: "/terms" },
};

const UPDATED = "16 June 2026";

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-navy">{n}. {title}</h2>
      <div className="mt-1 space-y-2 text-[15px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  const host = SITE.url.replace(/^https?:\/\//, "");
  return (
    <>
      <Hero title="Terms & Conditions" tag="The agreement for using AssetFrame." />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <p className="text-sm text-muted-foreground">
          Last updated: {UPDATED}. These terms are a binding agreement between you and {SITE.brand}
          (&ldquo;{SITE.brand}&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By accessing{" "}
          <a className="text-navy underline" href={SITE.url}>{host}</a>, creating an account, subscribing,
          or using our API, you confirm you have read, understood, and agree to be bound by these terms and
          our <a className="text-navy underline" href="/privacy">Privacy Policy</a>. If you do not agree, do
          not use the service.
        </p>

        <Clause n="1" title="Acceptance and eligibility">
          <p>You must be at least <b>18 years old</b> and legally able to form a binding contract to use {SITE.brand}. By using the service you represent that you meet these requirements. If you use {SITE.brand} on behalf of an organisation, you confirm you are authorised to bind that organisation to these terms.</p>
          <p>You may not use the service where doing so would be unlawful in your jurisdiction. You are responsible for compliance with all laws, rules, and regulations that apply to you, including any local restrictions on accessing market research or financial information.</p>
        </Clause>

        <Clause n="2" title="Definitions">
          <p>In these terms: <b>&ldquo;Service&rdquo;</b> means the {SITE.brand} website, content, reports, API, MCP server, and related features. <b>&ldquo;Snapshot&rdquo;</b> means our free report tier. <b>&ldquo;Pro&rdquo;</b> means our paid subscription tier and the content available under it. <b>&ldquo;Content&rdquo;</b> means all reports, analysis, scores, data compilations, text, design, and software we make available. <b>&ldquo;API&rdquo;</b> means our read-only REST application programming interface and our MCP (Model Context Protocol) server. <b>&ldquo;You&rdquo;</b> means the person or organisation using the Service.</p>
        </Clause>

        <Clause n="3" title="Nature of the service — research, not advice">
          <p>{SITE.brand} publishes <b>general market research and decision-support analysis</b> on financial instruments. It is information and education only, produced and made available on a non-personalised basis to a general audience.</p>
          <p><b>It is not investment advice and not a personal recommendation.</b> We do not know your circumstances, objectives, financial situation, or risk tolerance, and nothing on the Service is a suggestion that any specific person should buy, sell, or hold any instrument. We do not provide advice or a personal recommendation within the meaning of the UK regulatory regime, we do not induce or invite you to engage in investment activity, and we do not arrange deals in, deal in, or manage investments. {SITE.brand} is <b>not authorised or regulated by the Financial Conduct Authority</b>, and using the Service creates <b>no advisory, fiduciary, agency, or broker–client relationship</b> between us.</p>
          <p>Our research uses defined, neutral language — &ldquo;research view&rdquo;, &ldquo;conditional scenario&rdquo;, &ldquo;invalidation&rdquo; — describing how price <i>might</i> behave under stated conditions. These are analytical references, never instructions to trade.</p>
          <p><b>Confidence scores, ratings, and any published track record are estimates and analytical aids, not promises or guarantees.</b> They reflect a modelled view at a point in time and may be wrong. <b>Past performance and historical scoring are not a reliable guide to future results.</b> Markets are uncertain, prices can move sharply against any analysis, and <b>no outcome is guaranteed</b>. You assume all risk arising from any decision you make, and you should carry out your own research and, where appropriate, consult an FCA-authorised financial adviser before acting.</p>
          <p><b>{SITE.brand} never places, modifies, or cancels trades or orders</b>, has no access to your brokerage account or funds, and cannot execute any transaction. Any execution is entirely your own action, taken elsewhere, at your own risk. See clause 12.</p>
        </Clause>

        <Clause n="4" title="Your account and security">
          <p>Some features require an account. Authentication is provided by our identity provider, <b>Clerk</b>. You agree to provide accurate, current information, to keep your login credentials confidential and secure, and not to share, sell, or transfer your account. You are responsible for all activity that occurs under your account.</p>
          <p>Notify us promptly at <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> if you suspect any unauthorised use of, or security breach affecting, your account. We are not liable for losses arising from your failure to safeguard your credentials.</p>
        </Clause>

        {/* TODO(copy): billing migrated from Lemon Squeezy to Clerk Billing (Stripe-backed);
            update the merchant-of-record / portal references in clauses 5 & 6 in the copy pass. */}
        <Clause n="5" title="Subscriptions and billing">
          <p>The Snapshot tier is free. <b>{SITE.brand} Pro</b> is a paid subscription priced at <b>{SITE.proPrice}</b> (or as otherwise shown to you at checkout). Pro is sold and billed by our merchant of record, <b>Lemon Squeezy</b>, which acts as the <b>seller / merchant of record</b>: it processes your payment, appears on your statement, issues your invoice, and <b>collects and remits any applicable taxes</b> (such as VAT or sales tax) based on your location. Your purchase is also subject to Lemon Squeezy&apos;s own terms.</p>
          <p>The price, currency, and billing period are shown at checkout. Unless stated otherwise, subscriptions <b>renew automatically</b> at the end of each billing period at the then-current price, using your saved payment method, until cancelled. By subscribing you authorise these recurring charges.</p>
          <p>We may change subscription prices or the features included in a tier. Any change to your renewal price will take effect from your next billing period and we will give you <b>reasonable advance notice</b>; if you do not accept the new price, you may cancel before it takes effect (see clause 6). Taxes are determined and applied by the merchant of record and may change as tax rules or your location change.</p>
        </Clause>

        <Clause n="6" title="Cancellation and refunds">
          <p>You can <b>cancel at any time</b> from your <a className="text-navy underline" href="/account">account</a>, from the Lemon Squeezy customer portal, or via your Lemon Squeezy receipt. Cancellation stops future renewals; your Pro access continues until the end of the period you have already paid for, and we do not provide partial-period refunds except where required by law.</p>
          <p><b>UK / EU consumer cancellation rights.</b> If you are a consumer, you normally have a statutory right to cancel a purchase of digital content within <b>14 days</b> and receive a refund. However, because Pro is digital content supplied immediately, by purchasing and accessing it you (a) <b>request that supply begins straight away, during the 14-day period</b>, and (b) <b>acknowledge that you will lose your statutory right to cancel</b> once supply (download or access) has begun. Where you have not yet accessed any Pro content, you keep the 14-day right to cancel for a refund.</p>
          <p>Nothing in this clause affects your other statutory rights as a consumer, including rights in respect of digital content that is faulty, not as described, or not of satisfactory quality. Refunds, where due, are handled under the merchant of record&apos;s policy and applicable consumer law. If you believe you are entitled to a refund, contact us at <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.</p>
        </Clause>

        <Clause n="7" title="Acceptable use">
          <p>You agree to use the Service lawfully and not to, and not to permit or enable others to:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>use the Service for any unlawful, fraudulent, or harmful purpose, or in breach of any applicable law or regulation;</li>
            <li>share, sell, or transfer your account or login credentials, or access Pro content you have not paid for;</li>
            <li>scrape, crawl, spider, data-mine, or harvest the Service, or use bots or automated means to access it beyond ordinary browsing or beyond the documented API (see clause 8);</li>
            <li>circumvent, disable, or interfere with paywalls, access controls, rate limits, or security features;</li>
            <li>introduce malware, attempt to gain unauthorised access to the Service or its infrastructure, or disrupt, overload, or impair its operation;</li>
            <li>reverse-engineer, decompile, or attempt to derive source code or underlying models, except to the extent this restriction is prohibited by law;</li>
            <li>use the Content or Service to build, train, or improve a competing product or service; or</li>
            <li>misrepresent the Service, remove or obscure proprietary notices, or imply endorsement, partnership, or that we provide you with personal financial advice.</li>
          </ul>
        </Clause>

        <Clause n="8" title="API and MCP terms">
          <p>We offer a <b>read-only REST API and an MCP server</b> for programmatic access. Free / Snapshot data may be accessed without authentication; <b>Pro content is gated behind OAuth and an active Pro subscription</b> and may only be accessed by the authenticated, entitled subscriber.</p>
          <p>Your use of the API is subject to <b>fair use</b> and any published rate limits and quotas. You must not engage in abusive, excessive, or automated scraping designed to circumvent limits, and you must not <b>redistribute, republish, resell, sub-licence, or make available to third parties</b> any Content obtained through the API (including any Pro content), or use it to populate or power another product. Where you display data sourced from the API, you must provide reasonable <b>attribution to {SITE.brand}</b>.</p>
          <p>The API may change, and endpoints may be deprecated or removed. We may <b>throttle, rate-limit, suspend, or revoke</b> API or MCP access at any time — including for breach of these terms, abuse, security concerns, or excessive load — with or without notice. The API is provided on the same &ldquo;as is&rdquo; basis as the rest of the Service (clause 11).</p>
        </Clause>

        <Clause n="9" title="Intellectual property and licence">
          <p>The Service and all Content — including the reports, analysis, scores, the {SITE.brand} name, logo, and marks, and all related software, text, design, and data compilations — are owned by {SITE.brand} or its licensors and are protected by intellectual-property laws. Market data underlying the reports remains the property of its respective providers.</p>
          <p>Subject to these terms and (for Pro) payment, we grant you a <b>limited, personal, non-exclusive, non-transferable, non-sub-licensable, revocable licence</b> to access and view the Content you are entitled to for your own <b>personal, non-commercial</b> use. Except for this licence, no rights, title, or interest in the Service or Content are granted to you, and all rights are reserved.</p>
          <p><b>Feedback.</b> If you send us suggestions, ideas, or feedback about the Service, you grant us a perpetual, irrevocable, worldwide, royalty-free licence to use and incorporate that feedback into the Service without restriction or any obligation to you.</p>
        </Clause>

        <Clause n="10" title="Third-party services">
          <p>We rely on third parties to run the Service — including <b>Clerk</b> (authentication), <b>Lemon Squeezy</b> (payments and as merchant of record), <b>Vercel</b> (hosting and analytics), <b>Cloudflare</b> (private file storage and content delivery), <b>Neon</b> (database), <b>Google</b> (analytics and reviews), and <b>Resend</b> (email). Your use of those services may also be governed by their own terms and policies. We are not responsible for third-party websites, content, or resources linked from or integrated with the Service, and links do not imply endorsement.</p>
        </Clause>

        <Clause n="11" title="Availability and &ldquo;as is&rdquo; — no warranty">
          <p>We aim to keep the Service available but <b>do not guarantee uninterrupted, timely, secure, or error-free operation</b>, and we may change, suspend, or discontinue any feature (including publishing cadence, the API, and individual reports) at any time. Reports are published as editions and may be updated or withdrawn.</p>
          <p>Reports are generated from third-party market data and public sources believed to be reliable, but we <b>do not warrant that any figure, level, score, or statement is accurate, complete, current, or fit for any purpose</b>. Data may be delayed, incomplete, or contain errors; each report discloses its sources and data-quality limitations, which you should read before relying on anything.</p>
          <p>To the fullest extent permitted by law, the Service and all Content are provided <b>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</b>, and we disclaim all warranties of any kind, whether express, implied, or statutory, including implied warranties or terms of satisfactory quality, fitness for a particular purpose, accuracy, and non-infringement.</p>
        </Clause>

        <Clause n="12" title="Limitation of liability">
          <p><b>Important carve-out.</b> Nothing in these terms excludes or limits our liability where it would be unlawful to do so. This includes liability for <b>death or personal injury caused by our negligence</b>, for <b>fraud or fraudulent misrepresentation</b>, and for any other liability that cannot be excluded or limited under the laws of England and Wales (including, for consumers, liability under the Consumer Rights Act 2015 that cannot lawfully be limited).</p>
          <p>Subject to that carve-out, and to the fullest extent permitted by law:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>{SITE.brand} and its operators are <b>not liable for any trading, investment, or financial losses</b>, or for any decision you make or refrain from making, based on the Service or any Content;</li>
            <li>we are not liable for any <b>indirect, incidental, special, consequential, or punitive loss</b>, or for any loss of profits, revenue, anticipated savings, goodwill, data, or business opportunity, however arising; and</li>
            <li>our <b>total aggregate liability</b> to you for all claims arising out of or relating to the Service or these terms is limited to the <b>greater of (a) the total amount you paid us in the 12 months immediately before the event giving rise to the claim, and (b) £100</b>.</li>
          </ul>
          <p>You acknowledge that the Service is decision-support and information only, that you are solely responsible for your own decisions, and that the allocation of risk in these terms is reasonable given the nature and price of the Service.</p>
        </Clause>

        <Clause n="13" title="Indemnity">
          <p>To the extent permitted by law, you agree to indemnify and hold harmless {SITE.brand} and its operators from and against any claims, liabilities, losses, damages, and reasonable costs (including legal fees) arising out of or relating to your breach of these terms, your misuse of the Service or API, or your violation of any law or third-party right. This clause does not apply to consumers except to the extent permitted by applicable law.</p>
        </Clause>

        <Clause n="14" title="Suspension and termination">
          <p>We may suspend or terminate your access to all or part of the Service — including your account and API access — immediately and without notice if you breach these terms, fail to pay, or where we reasonably need to protect the Service, other users, or third parties, or to comply with law. You may stop using the Service and close your account at any time.</p>
          <p>On termination, your licence to the Content ends and you must stop using it. Clauses that by their nature should survive termination — including 2, 3, 6, 8, 9, 11, 12, 13, and 15 to 18 — will survive.</p>
        </Clause>

        <Clause n="15" title="Changes to the service and to these terms">
          <p>We may modify, add to, or remove features of the Service at any time. We may also update these terms from time to time — for example to reflect changes in the Service, our providers, or the law. Material changes will be reflected by the <b>&ldquo;last updated&rdquo;</b> date above and, where significant, brought to your attention. Your continued use of the Service after a change takes effect means you accept the updated terms; if you do not agree, you should stop using the Service.</p>
        </Clause>

        <Clause n="16" title="Governing law and jurisdiction">
          <p>These terms, and any dispute or claim arising out of or in connection with them or the Service (including non-contractual disputes), are governed by the laws of <b>England and Wales</b>. The courts of England and Wales have exclusive jurisdiction, except that if you are a consumer resident elsewhere in the UK, you may also bring proceedings in your home courts, and nothing here deprives you of the protection of mandatory consumer-protection rules that apply where you live.</p>
        </Clause>

        <Clause n="17" title="General">
          <p><b>Severability.</b> If any provision of these terms is held invalid or unenforceable, it will be modified to the minimum extent necessary or severed, and the remaining provisions remain in full effect. <b>No waiver.</b> Our failure to enforce a term is not a waiver of it. <b>Assignment.</b> You may not assign or transfer these terms without our consent; we may assign them to a successor of our business or assets. <b>No partnership.</b> Nothing in these terms creates a partnership, agency, or employment relationship between us. <b>Entire agreement.</b> These terms and the Privacy Policy are the entire agreement between us regarding the Service and supersede any prior understanding, save that nothing limits liability for fraudulent misrepresentation.</p>
        </Clause>

        <Clause n="18" title="Contact">
          <p>Questions about these terms or the Service: <a className="text-navy underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.</p>
        </Clause>
      </div>
    </>
  );
}
