"use client";
import { type ReactNode } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export function Dropdown({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: string[]; label: string }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// Small grey section heading inside the add/edit form, so the fields read as labelled groups.
export function Section({ children }: { children: ReactNode }) {
  return <div className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-navy/70">{children}</div>;
}
