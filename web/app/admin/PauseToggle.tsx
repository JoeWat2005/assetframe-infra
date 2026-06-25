"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setAutomationPaused } from "./actions";
import { Button } from "@/components/ui/button";

// Pause/Resume the engine's daily automation. Mirrors AdminTierToggle: optimistic-free,
// just useTransition + router.refresh() so the pill re-renders from the fresh server state.
export default function PauseToggle({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      if (!paused && !window.confirm("Pause ALL scheduled automation (daily, weekly and monthly runs) until you resume? Manual runs still work.")) return;
      const r = await setAutomationPaused(!paused);
      if (r.ok) router.refresh();
    });
  return (
    <Button
      size="sm"
      variant={paused ? "default" : "outline"}
      disabled={pending}
      onClick={toggle}
      title={paused ? "All scheduled automation paused — click to resume" : "Scheduled automation active — click to pause all (daily/weekly/monthly)"}
    >
      {pending ? "…" : paused ? "Resume automation" : "Pause all automation"}
    </Button>
  );
}
