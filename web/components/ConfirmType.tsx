"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Type-to-confirm dialog for irreversible / destructive actions — the operator must TYPE the exact
// phrase before the confirm button enables, so a single misclick can never trigger a data wipe (a
// stronger gate than window.confirm). Render it only while a confirm is pending, e.g.
//   {confirm && <ConfirmType key={confirm.phrase} {...confirm} onConfirm={...} onCancel={...} />}
// so it mounts fresh each time (the typed value resets naturally on mount).
export function ConfirmType({
  phrase, title, body, confirmLabel = "Confirm", onConfirm, onCancel,
}: {
  phrase: string;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Focus the input on open + close on Escape. (Subscription only — no state set in the effect.)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [onCancel]);

  const matched = typed.trim() === phrase;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-type-title"
        className="w-full max-w-md rounded-xl border border-line bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-type-title" className="text-base font-bold text-[#cf222e]">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <label htmlFor="confirm-type-input" className="mt-4 block text-xs font-semibold text-muted-foreground">
          Type <span className="rounded bg-tile px-1 font-mono text-foreground">{phrase}</span> to confirm
        </label>
        <Input
          id="confirm-type-input"
          ref={inputRef}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          aria-label={`Type ${phrase} to confirm`}
          autoComplete="off"
          className="mt-1"
          onKeyDown={(e) => { if (e.key === "Enter" && matched) onConfirm(); }}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            size="sm"
            disabled={!matched}
            onClick={onConfirm}
            className="bg-[#cf222e] text-white hover:bg-[#a01b23] disabled:opacity-50"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
