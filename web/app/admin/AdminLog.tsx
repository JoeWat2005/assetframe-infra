"use client";
import { useMemo, useState } from "react";
import type { AuditRow } from "@/lib/audit";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LABEL: Record<string, string> = {
  grant_pro: "Grant Pro", revoke_pro: "Revoke Pro", revalidate: "Revalidate",
  billing_grant: "Billing · grant", billing_revoke: "Billing · revoke", grant_unresolved: "Unresolved grant",
};
const label = (a: string) => LABEL[a] ?? a;

export default function AdminLog({ rows }: { rows: AuditRow[] }) {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const actions = useMemo(() => Array.from(new Set(rows.map((r) => r.action))).sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (action !== "all" && r.action !== action) return false;
        if (q) {
          const hay = `${r.actor} ${r.target} ${r.detail} ${label(r.action)}`.toLowerCase();
          if (!hay.includes(q.toLowerCase())) return false;
        }
        return true;
      }),
    [rows, q, action]
  );

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search actor, member, detail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-[170px]">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">All actions</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>{label(a)}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet. Admin and billing actions will appear here.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No matching activity.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full overflow-hidden rounded-xl border border-line bg-white text-sm">
            <thead className="bg-tile text-navy">
              <tr>
                <th className="p-3 text-left">When (UTC)</th>
                <th className="p-3 text-left">Action</th>
                <th className="p-3 text-left">Target</th>
                <th className="p-3 text-left">By</th>
                <th className="p-3 text-left">Detail</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="whitespace-nowrap p-3 font-mono text-[12px] text-muted-foreground">{r.ts}</td>
                  <td className="whitespace-nowrap p-3 font-semibold text-navy">{label(r.action)}</td>
                  <td className="p-3">{r.target}</td>
                  <td className="p-3 text-muted-foreground">{r.actor || "—"}</td>
                  <td className="p-3 text-muted-foreground">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{filtered.length} of {rows.length} entries</p>
        </div>
      )}
    </div>
  );
}
