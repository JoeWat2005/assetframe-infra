"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelGenerationRequest, cancelEngineCommand } from "./actions";

// Request cancellation of a queued/running generation request (kind="request", default) or a box
// command (kind="command"). Co-operative: the VM stops at its next safe point. Mirrors
// ApproveButton's pill styling + useTransition + router.refresh().
export default function CancelButton({ id, kind = "request" }: { id: string; kind?: "request" | "command" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cancel = () =>
    start(async () => {
      const r = kind === "command" ? await cancelEngineCommand(id) : await cancelGenerationRequest(id);
      if (r.ok) router.refresh();
    });
  return (
    <button
      type="button"
      disabled={pending}
      onClick={cancel}
      title="Request cancellation — the engine stops at the next safe point"
      className="shrink-0 rounded-full bg-[#ffebe9] px-2.5 py-0.5 text-[11px] font-bold text-[#cf222e] transition hover:bg-[#ffd7d5] disabled:opacity-50"
    >
      {pending ? "…" : "Cancel"}
    </button>
  );
}
