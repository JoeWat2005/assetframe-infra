"use client";
import { useTransition } from "react";
import { useUser } from "@clerk/nextjs";
import { getCheckoutUrl } from "@/lib/checkout-actions";

// Subscribe button with three states:
//  - already subscribed  -> manage subscription (no double-billing)
//  - not signed in        -> sign up first (checkout MUST be bound to an account)
//  - signed in            -> server-built checkout URL with a signed token binding it to
//                            this account (so the payment is credited correctly regardless
//                            of the email entered at checkout).
export default function BuyButton({
  children,
  className = "",
  full = false,
}: {
  children: React.ReactNode;
  className?: string;
  full?: boolean;
}) {
  const { user, isSignedIn, isLoaded } = useUser();
  const [pending, start] = useTransition();
  const gold = `inline-flex items-center justify-center rounded-lg bg-[#9a6700] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 ${
    full ? "w-full" : ""
  } ${className}`;

  const subscribed = (user?.publicMetadata as { subscribed?: boolean } | undefined)?.subscribed === true;
  if (subscribed) {
    return (
      <a
        href="/account/subscription"
        className={`inline-flex items-center justify-center rounded-lg border border-[#9a6700] bg-[#fff7e6] px-4 py-2.5 text-sm font-bold text-[#9a6700] transition hover:opacity-90 ${
          full ? "w-full" : ""
        } ${className}`}
      >
        You&apos;re on Pro — manage subscription
      </a>
    );
  }

  // Require an account before checkout so the payment can be bound to it. Send them to
  // sign-up (which links to sign-in), returning to pricing to subscribe.
  if (isLoaded && !isSignedIn) {
    return (
      <a href="/sign-up?redirect_url=%2Fpricing" className={gold}>
        {children}
      </a>
    );
  }

  const go = () =>
    start(async () => {
      try {
        const { url } = await getCheckoutUrl();
        if (url) window.location.href = url;
      } catch {
        /* leave the button as-is; the user can retry */
      }
    });

  return (
    <button type="button" onClick={go} disabled={pending || !isLoaded} className={gold}>
      {pending ? "Loading…" : children}
    </button>
  );
}
