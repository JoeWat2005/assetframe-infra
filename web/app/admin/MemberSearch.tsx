"use client";
import { useState, useTransition } from "react";
import { searchMembers } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import ProToggle from "./ProToggle";

type Member = { id: string; email: string; subscribed: boolean };

export default function MemberSearch() {
  const [q, setQ] = useState("");
  const [members, setMembers] = useState<Member[] | null>(null);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setMsg("");
      try {
        const r = await searchMembers(q);
        if (r.ok) setMembers(r.members ?? []);
        else { setMembers([]); setMsg(r.message ?? "Search failed."); }
      } catch {
        setMembers([]);
        setMsg("Search failed.");
      }
    });

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <Input
          placeholder="Search by email or name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Button type="submit" size="sm" disabled={pending || !q.trim()}>
          {pending ? "Searching…" : "Search"}
        </Button>
      </form>
      {msg && <p className="mt-2 text-sm text-[#cf222e]">{msg}</p>}
      {members && !msg && (
        members.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No members found.</p>
        ) : (
          <div className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="truncate">{m.email}</span>
                <ProToggle email={m.email} subscribed={m.subscribed} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
