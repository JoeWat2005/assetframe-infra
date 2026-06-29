"use client";
import { setAssetEnabled, deleteEngineAsset } from "./actions";
import type { EngineAsset } from "@/lib/engine-assets";

export function AssetTable({
  assets, pending, startEdit, run,
}: {
  assets: EngineAsset[];
  pending: boolean;
  startEdit: (a: EngineAsset) => void;
  run: (fn: () => Promise<{ ok: boolean; message: string }>, confirmMsg?: string) => void;
}) {
  return (
    <>
      {/* Universe table */}
      {assets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-tile/40 px-4 py-6 text-center text-sm text-muted-foreground">No assets yet — click <b>+ Add asset</b> to add your first instrument.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-tile text-navy">
              <tr>
                <th className="p-2.5 text-left">Ticker</th>
                <th className="p-2.5 text-left">Instrument</th>
                <th className="p-2.5 text-left">Class</th>
                <th className="p-2.5 text-left">Cadence</th>
                <th className="p-2.5 text-left">Scheduled</th>
                <th className="p-2.5 text-left">Publish</th>
                <th className="p-2.5 text-left">In daily run</th>
                <th className="p-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="p-2.5 font-semibold text-navy">{a.ticker}</td>
                  <td className="p-2.5 text-muted-foreground">{a.name}</td>
                  <td className="p-2.5">{a.assetClass}</td>
                  <td className="p-2.5 text-muted-foreground">{a.cadence}</td>
                  <td className="p-2.5" title={a.dueReason || undefined}>
                    {!a.enabled ? (
                      <span className="text-[11px] text-muted-foreground">off</span>
                    ) : a.due == null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : a.due ? (
                      <span className="rounded-full bg-[#dafbe1] px-2 py-0.5 text-[11px] font-bold text-[#1a7f37]">Due now</span>
                    ) : (
                      <span className="rounded-full bg-tile px-2 py-0.5 text-[11px] font-bold text-muted-foreground">Not due</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${a.publishPolicy === "auto" ? "bg-[#dafbe1] text-[#1a7f37]" : "bg-[#fff7e6] text-[#9a6700]"}`}>
                      {a.publishPolicy === "auto" ? "auto" : "approval"}
                    </span>
                  </td>
                  <td className="p-2.5">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => setAssetEnabled(a.id, !a.enabled))}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition disabled:opacity-50 ${a.enabled ? "bg-[#dafbe1] text-[#1a7f37] hover:bg-[#b7f0c6]" : "bg-tile text-muted-foreground hover:bg-line"}`}
                      title={a.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
                    >
                      {a.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                  <td className="p-2.5 text-right">
                    <button
                      type="button" disabled={pending}
                      onClick={() => startEdit(a)}
                      className="mr-1.5 rounded-full bg-tile px-2.5 py-0.5 text-[11px] font-bold text-navy transition hover:bg-line disabled:opacity-50"
                      title="Edit this asset's settings"
                    >
                      Edit
                    </button>
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => deleteEngineAsset(a.id), `Remove ${a.ticker} from the universe?`)}
                      className="rounded-full bg-[#ffebe9] px-2.5 py-0.5 text-[11px] font-bold text-[#cf222e] transition hover:bg-[#ffd7d5] disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
