import Link from "next/link";
import { Lock, FileText, BookOpen } from "lucide-react";
import type { Edition } from "@/lib/content";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS: Record<string, string> = {
  buy: "#1a7f37", sell: "#cf222e", wait: "#9a6700",
  "stand aside": "#57606a", neutral: "#0969da", hold: "#0969da",
};
const RISK: Record<string, string> = {
  low: "#1a7f37", medium: "#9a6700", high: "#bc4c00", "very high": "#cf222e",
};

function ColorBadge({ label, color }: { label: string; color: string }) {
  // Domain status colours carry meaning (buy/sell/risk), so they're set explicitly.
  return (
    <Badge style={{ backgroundColor: color }} className="border-transparent text-white">
      {label}
    </Badge>
  );
}

export default function ReportCard({ e }: { e: Edition }) {
  const sc = STATUS[(e.status || "").trim().toLowerCase()] ?? "#57606a";
  const rc = RISK[(e.risk || "").trim().toLowerCase()] ?? "#57606a";
  return (
    <Card className="flex flex-col transition-shadow hover:shadow-md">
      <CardHeader>
        <CardTitle className="text-lg">{e.instrument}</CardTitle>
        <CardDescription>
          {e.ticker} · {e.assetClass}
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {e.status && <ColorBadge label={e.status} color={sc} />}
          {e.risk && <ColorBadge label={`Risk: ${e.risk}`} color={rc} />}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm">{e.bias}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Edition {e.reportDate} · window to {e.windowEnd}
        </p>
        {e.dataQuality !== "" && (
          <p className="text-xs text-muted-foreground">Data quality {e.dataQuality}/10</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={e.freeHtml} target="_blank" rel="noopener noreferrer">
            <BookOpen data-icon="inline-start" />
            Snapshot
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={e.freePdf} target="_blank" rel="noopener noreferrer">
            <FileText data-icon="inline-start" />
            PDF
          </a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href={`/reports/${e.date}/${e.slug}`}>
            <Lock data-icon="inline-start" />
            Pro
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
