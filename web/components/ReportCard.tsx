import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { Edition } from "@/lib/content";
import { assetCategory } from "@/lib/taxonomy";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// White text on these, so each must clear WCAG AA 4.5:1 (sell/high/very-high darkened).
const STATUS: Record<string, string> = {
  buy: "#1a7f37", sell: "#b91c1c", wait: "#9a6700",
  "stand aside": "#57606a", neutral: "#0969da", hold: "#0969da",
};
const RISK: Record<string, string> = {
  low: "#1a7f37", medium: "#9a6700", high: "#9a3d00", "very high": "#b91c1c",
};

function ColorBadge({ label, color }: { label: string; color: string }) {
  // Domain status colours carry meaning (buy/sell/risk), so they're set explicitly.
  return (
    <Badge style={{ backgroundColor: color }} className="border-transparent text-white">
      {label}
    </Badge>
  );
}

// `animate` defaults to true (scroll-reveal on static pages like the homepage). Pass
// animate={false} in interactive/filtered lists (the reports browser) — there the scroll
// reveal would leave reused/reordered cards stranded at opacity:0 on a filter change.
export default function ReportCard({ e, animate = true }: { e: Edition; animate?: boolean }) {
  const sc = STATUS[(e.status || "").trim().toLowerCase()] ?? "#57606a";
  const rc = RISK[(e.risk || "").trim().toLowerCase()] ?? "#57606a";
  const href = `/reports/${e.date}/${e.slug}`;
  // One clear entry point: the reader page. It gates the actual Snapshot/Pro files behind
  // an account, so cards never expose report files directly. The preview is a public thumbnail.
  return (
    <Card data-animate={animate ? "up" : undefined} className="flex flex-col overflow-hidden transition-shadow hover:shadow-md">
      {e.preview && (
        <Link href={href} aria-label={e.instrument} className="group block aspect-[16/9] overflow-hidden border-b border-line bg-tile">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={e.preview}
            alt={`${e.instrument} report preview`}
            loading="lazy"
            className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
      )}
      <CardHeader>
        <CardTitle className="text-lg">{e.instrument}</CardTitle>
        <CardDescription>
          {e.ticker} · {e.assetClass}
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.status && <ColorBadge label={e.status} color={sc} />}
          {e.risk && <ColorBadge label={`Risk: ${e.risk}`} color={rc} />}
          <Badge variant="outline" className="font-medium text-muted-foreground">
            {assetCategory(e.assetClass)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm">{e.bias}</p>
        {e.confidence != null && (
          <p className="mt-1 text-xs font-semibold text-navy">Confidence {e.confidence}/100</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Edition {e.reportDate} · window to {e.windowEnd}
        </p>
        {e.dataQuality !== "" && (
          <p className="text-xs text-muted-foreground">Data quality {e.dataQuality}/10</p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2">
        <Button asChild size="sm">
          <Link href={href}>
            View report
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        {e.hasPro && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#9a6700]">
            <Lock className="size-3.5" /> Pro available
          </span>
        )}
      </CardFooter>
    </Card>
  );
}
