"use client";
import { useUser } from "@clerk/nextjs";

// Subscribe/upgrade button with three states:
//  - admin                -> comped Pro; never bills — point at the admin dashboard
//  - already subscribed   -> manage subscription (no double-billing)
//  - everyone else        -> /pricing, where Clerk Billing's <PricingTable /> handles
//                            sign-in (if needed) and the in-page checkout drawer.
export default function BuyButton({
  children,
  className = "",
  full = false,
  admin = false,
}: {
  children: React.ReactNode;
  className?: string;
  full?: boolean;
  admin?: boolean;
}) {
  const { user } = useUser();
  const gold = `inline-flex items-center justify-center rounded-lg bg-[#9a6700] px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 ${
    full ? "w-full" : ""
  } ${className}`;
  const calm = `inline-flex items-center justify-center rounded-lg border border-[#9a6700] bg-[#fff7e6] px-4 py-2.5 text-sm font-bold text-[#9a6700] transition hover:opacity-90 ${
    full ? "w-full" : ""
  } ${className}`;

  const meta = user?.publicMetadata as { subscribed?: boolean; role?: string; adminTier?: string } | undefined;
  const subscribed = meta?.subscribed === true;
  // Admin signal: the server-passed `admin` prop is authoritative; client-side we also treat a
  // Clerk "admin" role or the presence of `adminTier` (only ever set on admins) as admin, so
  // email-allowlist admins are caught even without the prop.
  const isAdmin = admin || meta?.role === "admin" || meta?.adminTier !== undefined;

  // Admins are comped and fully decoupled from billing — NEVER a checkout and never a billing
  // "manage" link, regardless of any stale paid flag. Their tier is the Free/Pro toggle on the
  // admin dashboard. Checked before the subscribed branch so a free-preview admin never sees
  // "You're on Pro".
  if (isAdmin) {
    return (
      <a href="/admin" className={calm}>
        Admin access — set your view on the dashboard
      </a>
    );
  }

  if (subscribed) {
    return (
      <a href="/account/subscription" className={calm}>
        You&apos;re on Pro — manage subscription
      </a>
    );
  }

  // Everyone else: send them to the pricing page, where Clerk Billing's PricingTable prompts
  // sign-in if needed and runs the in-page checkout drawer bound to their account.
  return (
    <a href="/pricing" className={gold}>
      {children}
    </a>
  );
}
