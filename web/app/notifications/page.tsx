import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { getWatchlist } from "@/lib/social";
import { getCatalog } from "@/lib/content";
import { Hero } from "@/components/ui";
import PushToggle from "@/components/PushToggle";
import FollowingList from "@/components/FollowingList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Notifications",
  description:
    "Control your AssetFrame notifications: enable push alerts for instruments you follow, and manage your email newsletter subscription.",
  alternates: { canonical: "/notifications" },
};

export default async function NotificationsPage() {
  const { userId } = await auth();
  const signedIn = !!userId;

  let follows: Awaited<ReturnType<typeof getWatchlist>> = [];
  let followLinks: Record<string, string> = {};

  if (signedIn) {
    const [watchlist, catalog] = await Promise.all([getWatchlist(userId), getCatalog()]);
    follows = watchlist;
    const latestBySlug = new Map<string, string>();
    for (const e of catalog) if (!latestBySlug.has(e.slug)) latestBySlug.set(e.slug, e.date);
    followLinks = Object.fromEntries(
      follows.map((f) => {
        const date = latestBySlug.get(f.symbol);
        return [f.symbol, date ? `/reports/${date}/${f.symbol}` : "/reports"];
      })
    );
  }

  return (
    <>
      <Hero
        title="Notifications"
        tag="Control how AssetFrame keeps you informed."
      />
      <div className="mx-auto max-w-3xl px-5 py-8">

        {/* ── How it works ─────────────────────────────── */}
        <div className="rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">How notifications work</h2>
          <div className="mt-3 flex flex-col gap-3 text-sm text-muted-foreground">
            <div className="rounded-lg border border-line bg-tile p-3">
              <p className="font-semibold text-ink">Newsletter (email)</p>
              <p className="mt-0.5">
                A daily digest of every new edition published that day — all instruments, one email.
                You don&rsquo;t need an account to subscribe.
              </p>
            </div>
            <div className="rounded-lg border border-line bg-tile p-3">
              <p className="font-semibold text-ink">Push notifications (this browser)</p>
              <p className="mt-0.5">
                A push alert fires only for instruments you <b>follow</b> — never a catch-all digest.
                Push is per-device: enabling it on your phone is separate from enabling it on your
                laptop. To stop push alerts, use the toggle below; this removes only the
                subscription for this browser and leaves your follows intact.
              </p>
            </div>
          </div>
        </div>

        {/* ── Push notifications ───────────────────────── */}
        <div className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Push notifications</h2>
          {signedIn ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Get a push notification on this device when a new edition publishes for an
                instrument you follow. You must both enable push <em>and</em> follow at least one
                instrument below.
              </p>
              <PushToggle />
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Push notifications are tied to your account.{" "}
              <Link href="/sign-in" className="font-semibold text-navy underline underline-offset-2">
                Sign in
              </Link>{" "}
              to enable push for the instruments you follow.
            </p>
          )}
        </div>

        {/* ── Followed instruments ─────────────────────── */}
        <div className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Instruments you follow</h2>
          {signedIn ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Push alerts are sent only for the instruments listed here. Open any report and tap{" "}
                <b>Follow</b> to add an instrument.
              </p>
              <FollowingList initial={follows} links={followLinks} />
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/sign-in" className="font-semibold text-navy underline underline-offset-2">
                Sign in
              </Link>{" "}
              to manage the instruments you follow and receive push alerts when they publish new
              editions.
            </p>
          )}
        </div>

        {/* ── Newsletter ───────────────────────────────── */}
        <div className="mt-6 rounded-xl border border-line bg-white p-5">
          <h2 className="text-lg font-bold text-navy">Newsletter</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A daily email digest of every new edition — all instruments in one message. It&rsquo;s
            separate from push notifications; you can have both, either, or neither.{" "}
            <strong className="font-semibold text-ink">Subscribe using the newsletter form in the
            site footer.</strong>{" "}
            To unsubscribe, use the &ldquo;Unsubscribe&rdquo; link at the bottom of any newsletter
            email (every newsletter includes a one-click unsubscribe).
          </p>
        </div>

      </div>
    </>
  );
}
