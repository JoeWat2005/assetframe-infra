"use client";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { CancelResult } from "@/lib/lemonsqueezy";

const MESSAGES: Record<string, string> = {
  "no-api-key": "In-app cancellation isn't enabled yet — use the billing portal, or reply to your receipt email.",
  "no-subscription": "We couldn't find an active subscription on your account.",
  "http-error": "The billing provider rejected the request. Please try the billing portal.",
  network: "Network error reaching the billing provider. Please try again.",
};

export default function CancelSubscription({ onCancel }: { onCancel: () => Promise<CancelResult> }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await onCancel();
      setMsg(
        r.ok
          ? { ok: true, text: "Your subscription is set to cancel at the end of the current billing period. You keep Pro access until then." }
          : { ok: false, text: MESSAGES[r.reason] ?? "Something went wrong." }
      );
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={pending} className="w-fit">
            {pending && <Loader2 data-icon="inline-start" className="animate-spin" />}
            Cancel subscription
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel your AssetFrame Pro subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll keep Pro access until the end of your current billing period, then it
              won&apos;t renew. You can resubscribe anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my subscription</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={run}>
              Yes, cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {msg && <p className={msg.ok ? "text-sm text-[#1a7f37]" : "text-sm text-destructive"}>{msg.text}</p>}
    </div>
  );
}
