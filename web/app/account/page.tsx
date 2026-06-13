import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCatalog } from "@/lib/content";
import { getEntitlement } from "@/lib/entitlements";
import { Btn, Hero, Note } from "@/components/ui";
import BuyButton from "@/components/BuyButton";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");

  const catalog = await getCatalog();

  return (
    <>
      <Hero title="Your account" tag={ent.subscribed ? "AssetFrame Pro — active" : "Free member"} />
      <div className="mx-auto max-w-3xl px-5 py-8">
        {ent.admin && (
          <Note><b>Admin.</b> You have admin access — open the <a className="text-navy underline" href="/admin">dashboard</a>.</Note>
        )}

        {!ent.subscribed && (
          <div className="mb-6 rounded-xl border border-[#e6c88a] bg-[#fffdf5] p-5">
            <div className="text-lg font-bold text-[#9a6700]">Upgrade to Pro</div>
            <p className="mt-1 text-sm text-muted">Unlock conditional setups, the price ladder, risk math and the full ledger on every edition.</p>
            <div className="mt-3">
              <BuyButton>Subscribe {SITE.proPrice}</BuyButton>
            </div>
          </div>
        )}

        <h2 className="mb-1 text-xl font-bold text-navy">Pro reports</h2>
        <p className="mb-3 text-sm text-muted">
          {ent.subscribed ? "Open any edition's Pro report." : "Subscribe to open these."}
        </p>
        <div className="overflow-hidden rounded-xl border border-line bg-white">
          {catalog.length === 0 ? (
            <p className="p-4 text-sm text-muted">No editions yet.</p>
          ) : catalog.map((e) => (
            <div key={`${e.date}/${e.slug}`} className="flex items-center justify-between border-b border-line p-3 last:border-0">
              <div>
                <b>{e.instrument}</b> <span className="text-[13px] text-muted">{e.ticker}</span>
                <div className="text-xs text-muted">Edition {e.reportDate}</div>
              </div>
              {ent.subscribed ? (
                <div className="flex gap-2">
                  <Btn href={`/api/pro/${e.date}/${e.slug}/pro.html`} external sm>Read</Btn>
                  <Btn href={`/api/pro/${e.date}/${e.slug}/pro.pdf`} external sm>PDF</Btn>
                </div>
              ) : (
                <span className="text-xs text-muted">🔒 Pro</span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Btn href="/account/subscription" variant="primary">Manage subscription</Btn>
          <span className="text-sm text-muted">
            {ent.subscribed ? "View your plan, billing and cancellation." : "View plans and upgrade."}
          </span>
        </div>
      </div>
    </>
  );
}
