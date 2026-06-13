import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { getEntitlement } from "@/lib/entitlements";
import { Hero } from "@/components/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import BuyButton from "@/components/BuyButton";
import CancelSubscription from "@/components/CancelSubscription";
import { cancelMySubscription } from "./actions";
import { SITE } from "@/site.config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Subscription" };

// LS dates look like "2026-07-13T09:00:00.000000Z" — show the date part only.
const fmtDate = (iso?: string) => (iso ? iso.slice(0, 10) : null);

export default async function SubscriptionPage() {
  const ent = await getEntitlement();
  if (!ent.signedIn) redirect("/sign-in");

  const cancelling = ent.subStatus === "cancelled";
  const renews = fmtDate(ent.renewsAt);
  const ends = fmtDate(ent.endsAt);
  const canCancelInApp = ent.subscribed && !!ent.subscriptionId && !!process.env.LEMONSQUEEZY_API_KEY;

  return (
    <>
      <Hero title="Subscription" tag="Manage your AssetFrame Pro plan and billing." />
      <div className="mx-auto max-w-2xl px-5 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {ent.subscribed ? ent.planName || "AssetFrame Pro" : "Free plan"}
            </CardTitle>
            <CardDescription>{ent.email}</CardDescription>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant={ent.subscribed ? "default" : "secondary"}>
                {ent.subscribed ? (cancelling ? "Cancelling" : "Active") : "Free"}
              </Badge>
              {ent.admin && <Badge variant="outline">Admin</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {ent.subscribed ? (
              <>
                {cancelling && ends ? (
                  <p>Your plan is cancelled — Pro access ends on <b>{ends}</b>.</p>
                ) : renews ? (
                  <p>Renews on <b>{renews}</b> at {SITE.proPrice}.</p>
                ) : (
                  <p>Your AssetFrame Pro plan is active.</p>
                )}
                <p className="text-muted-foreground">
                  Billing is handled securely by Lemon Squeezy, our merchant of record.
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
            {!ent.subscribed && <BuyButton>Subscribe {SITE.proPrice}</BuyButton>}
            {ent.portalUrl && (
              <Button asChild variant="outline">
                <a href={ent.portalUrl} target="_blank" rel="noopener noreferrer">
                  Billing portal
                  <ExternalLink data-icon="inline-end" />
                </a>
              </Button>
            )}
            <Button asChild variant="ghost">
              <Link href="/account">Back to account</Link>
            </Button>
          </CardFooter>
        </Card>

        {ent.subscribed && !cancelling && (
          <>
            <Separator className="my-6" />
            <h2 className="mb-1 text-base font-semibold">Cancel subscription</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Cancel anytime — you keep Pro access until the end of your current billing period.
            </p>
            {canCancelInApp ? (
              <CancelSubscription onCancel={cancelMySubscription} />
            ) : ent.portalUrl ? (
              <Button asChild variant="destructive" className="w-fit">
                <a href={ent.portalUrl} target="_blank" rel="noopener noreferrer">
                  Cancel in billing portal
                  <ExternalLink data-icon="inline-end" />
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                To cancel, reply to your Lemon Squeezy receipt email or contact{" "}
                <a className="underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
              </p>
            )}
          </>
        )}
      </div>
    </>
  );
}
