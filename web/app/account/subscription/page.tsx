import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PricingTable } from "@clerk/nextjs";
import { getEntitlement } from "@/lib/entitlements";
import { Hero } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscription" };

// Billing dates look like "2026-07-13T09:00:00.000000Z" — show the date part only.
const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : null);

export default async function SubscriptionPage({
  searchParams,
}: { searchParams: Promise<{ welcome?: string }> }) {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");
  const { welcome } = await searchParams;

  // "paid" = a real Clerk Billing subscription. Admins get Pro comped, so ent.subscribed
  // can be true with no paid plan — the billing card keys off `paid`, never the comp.
  const paid = ent.billingActive;
  const renews = fmtDate(ent.renewsAt);
  // Admins are kept entirely outside billing: they ALWAYS see the complimentary-Pro card
  // (never a paid / checkout state). Admin Pro is comped by role and never depends on a plan.
  const compOnly = ent.admin;

  return (
    <>
      <Hero title="Subscription" tag="Manage your AssetFrame Pro plan and billing." />
      <div className="mx-auto max-w-2xl px-5 py-8">
        {welcome === "1" && (
          <div className="mb-4 rounded-xl border border-[#acdfb9] bg-[#eaffef] p-4 text-sm text-[#1a7f37]">
            <b>Welcome to AssetFrame Pro!</b> Your payment went through. If a Pro report still looks
            locked, give it a few seconds and refresh — access activates as soon as the payment confirms.
          </div>
        )}

        {compOnly ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">AssetFrame Pro — complimentary</CardTitle>
              <CardDescription>{ent.email}</CardDescription>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="default">Admin</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>You have full Pro access as an admin — no subscription, payment or billing to manage.</p>
              <p className="text-muted-foreground">
                Switch your own view between the <b>Free</b> and <b>Pro</b> tiers — and manage members
                and content — from the{" "}
                <Link className="font-semibold text-navy underline underline-offset-2" href="/admin">admin dashboard</Link>.
              </p>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/admin">Admin dashboard</Link></Button>
              <Button asChild variant="ghost"><Link href="/account">Back to account</Link></Button>
            </CardFooter>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {paid ? ent.planName || "AssetFrame Pro" : "Free plan"}
                </CardTitle>
                <CardDescription>{ent.email}</CardDescription>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant={paid ? "default" : "secondary"}>{paid ? "Active" : "Free"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {paid ? (
                  <>
                    {renews ? (
                      <p>Renews on <b>{renews}</b> at {SITE.proPrice}.</p>
                    ) : (
                      <p>Your AssetFrame Pro plan is active.</p>
                    )}
                    <p className="text-muted-foreground">
                      Billing is handled securely by our merchant of record. Manage or cancel your plan below.
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    You&apos;re on the free plan — Snapshots only. Upgrade to unlock Pro reports, the
                    price ladder and the full outcome ledger on every edition.
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button asChild variant="ghost">
                  <Link href="/account">Back to account</Link>
                </Button>
              </CardFooter>
            </Card>

            <Separator className="my-6" />
            <h2 className="mb-1 text-base font-semibold">
              {paid ? "Manage your plan" : "Upgrade to Pro"}
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {paid
                ? "Change or cancel your plan below — you keep Pro access until the end of the period you've paid for."
                : "Subscribe below to unlock every Pro report. Cancel anytime."}
            </p>
            {/* Clerk Billing: shows the current plan with cancel/upgrade for subscribers, or the
                checkout drawer for free users — all in-page, no external portal. */}
            <PricingTable />
          </>
        )}
      </div>
    </>
  );
}
