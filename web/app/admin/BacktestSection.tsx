import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import GenerateForm from "./GenerateForm";
import BacktestResults from "./BacktestResults";
import type { BacktestResult, BacktestPrediction } from "@/lib/engine";

export default function BacktestSection({
  assets,
  backtestResults,
  backtestPredictions,
}: {
  assets: { slug: string; instrument: string; ticker: string }[];
  backtestResults: BacktestResult[];
  backtestPredictions: BacktestPrediction[];
}) {
  return (
        <Card id="sec-backtest" className="mt-4 scroll-mt-24 border-2 border-dashed border-[#bf8700]/40 bg-[#fff7e6]/30">
          <CardHeader>
            <CardTitle className="text-base text-[#9a6700]">Sandbox backtester</CardTitle>
            <CardDescription>
              Generate + score assets <b>backdated</b> to a closed window in an <b>isolated sandbox</b> — test
              scoring and seed the track record safely. Nothing here touches the public ledger, editions, R2 or
              track record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Settings are a compact 1/3 column; the results table gets the wider 2/3 so its
                instrument/thesis/predictions columns aren't cramped. */}
            <div className="grid gap-5 lg:grid-cols-3">
              <div>
                <h3 className="mb-2 text-sm font-bold text-[#9a6700]">Run a backtest</h3>
                <GenerateForm assets={assets} mode="backtest" />
              </div>
              <div className="lg:col-span-2 lg:border-l lg:border-[#bf8700]/30 lg:pl-5">
                <h3 className="mb-2 text-sm font-bold text-[#9a6700]">Results</h3>
                <BacktestResults rows={backtestResults} predictions={backtestPredictions} />
              </div>
            </div>
          </CardContent>
        </Card>
  );
}
