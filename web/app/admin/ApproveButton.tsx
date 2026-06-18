"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setEditionHidden } from "./actions";

// Approve (publish) an edition that was generated hidden behind the engine's approval gate.
// Reuses setEditionHidden(id, false) — the same action the EditionToggle uses to restore —
// then refreshes so the approved edition drops out of the pending list.
export default function ApproveButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const approve = () =>
    start(async () => {
      const r = await setEditionHidden(id, false);
      if (r.ok) router.refresh();
    });
  return (
    <button
      type="button"
      disabled={pending}
      onClick={approve}
      title="Approve — publish this edition to the public site"
      className="shrink-0 rounded-full bg-[#dafbe1] px-2.5 py-0.5 text-[11px] font-bold text-[#1a7f37] transition hover:bg-[#bff0cb] disabled:opacity-50"
    >
      {pending ? "…" : "Approve"}
    </button>
  );
}
