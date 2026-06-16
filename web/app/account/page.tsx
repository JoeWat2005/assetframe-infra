import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getEntitlement } from "@/lib/entitlements";
import { getWatchlist } from "@/lib/social";
import { Btn, Hero } from "@/components/ui";
import BuyButton from "@/components/BuyButton";
import FollowingList from "./FollowingList";
import PushToggle from "@/components/PushToggle";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  const { userId } = await auth();
  const follows = await getWatchlist(userId);
  const cancelling = ent.billingActive && ent.subStatus === "cancelled";
  const ends = ent.endsAt ? ent.endsAt.slice(0, 10) : null;
  // Admins are comped: they get Pro for free and never see billing/payment prompts.
  // The subscription footer only shows for non-admins, or for an admin who also happens
  // to hold a real paid subscription (so they can still manage/cancel it).
  const showManage = !ent.admin || ent.billingActive;

  return (
    <>
      <Hero
        title="Your account"
        tag={
          ent.admin
            ? "AssetFrame Admin — full access"
            : ent.subscribed
              ? cancelling ? "AssetFrame Pro — cancelling" : "AssetFrame Pro, active"
              : "Free member"
        }
      />
      <div className="mx-auto max-w-3xl px-5 py-8">
        {ent.admin ? (
          <div className="mb-6 rounded-xl border border-line bg-white p-5">
            <div className="text-lg font-bold text-navy">Admin access</div>
            <p className="mt-1 text-sm text-muted-foreground">
              You have complimentary Pro on every edition — no subscription or payment needed.
              {ent.adminTier === "free" &&
                " You're currently previewing the Free tier; switch back to Pro from the dashboard."}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Btn href="/admin" variant="primary">Open admin dashboard →</Btn>
              <Btn href="/reports">Browse reports</Btn>
            </div>
          </div>
        ) : !ent.subscribed ? (
          <div className="mb-6 rounded-xl border border-[#e6c88a] bg-[#fffdf5] p-5">
            <div className="text-lg font-bold text-[#9a6700]">Upgrade to Pro</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Unlock conditional setups, the price ladder, risk math and the full ledger on every edition.
            </p>
            <div className="mt-3"><BuyButton>Subscribe {SITE.proPrice}</BuyButton></div>
          </div>
        ) : null}

        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Reports</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ent.admin
              ? "You can open the Snapshot and the full Pro report on every edition."
              : ent.subscribed
                ? cancelling
                  ? `Your plan is cancelled — Pro access stays on until ${ends ?? "the end of your billing period"}, then it ends. No further charge.`
                  : "Your Pro access is active. Open any edition's Snapshot or Pro report from the Reports page."
                : "Browse free Snapshots on the Reports page. Upgrade to unlock the Pro report on every edition."}
          </p>
          <div className="mt-3">
            <Btn href="/reports" variant="primary">Browse reports →</Btn>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Following</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Instruments you follow — we email you when a new edition publishes for them.
          </p>
          <FollowingList initial={follows} />
        </div>

        <div className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get a push notification the moment a new edition publishes — including instruments you
            follow. If push isn&rsquo;t available, we fall back to email.
          </p>
          <PushToggle />
        </div>

        {showManage && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Btn href="/account/subscription">Manage subscription</Btn>
            <span className="text-sm text-muted-foreground">
              {ent.billingActive ? "View your plan, billing and cancellation." : "View plans and upgrade."}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
