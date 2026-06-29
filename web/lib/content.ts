import "server-only";
import { unstable_cache } from "next/cache";

// Public types — re-exported verbatim from the dedicated types module so every existing
// importer (`import type { Edition } from "@/lib/content"`) keeps working unchanged.
export type {
  Edition, SubCall, OpenCall, ScoredRow, InstrumentPerf, AssetClassPerf, PredTypePerf,
  RegimePerf, HorizonPerf, CadencePerf, TimelinePoint, CalibrationBin, ComponentOutcome,
  TrackRecord,
} from "@/lib/content-types";

// Pure derivation helpers — unchanged public API.
export { horizonOf, cadenceOf } from "@/lib/content-helpers";

// DB-first reads. `getCatalog` is the cached catalog (wrapped in content-db so the in-module
// `getEdition` fallback can call it without a hub cycle); the rest are uncached query helpers.
export {
  getAllEditions, getHiddenEditions, getEdition, getEditionProKeys, getCatalog,
} from "@/lib/content-db";

import { _getTrackRecord, _getTrending } from "@/lib/content-db";

// Cached reads: the catalog and track record aren't user-specific, so serve them
// from Next's Data Cache for `revalidate` seconds. Reloads (even on dynamic pages
// like /account or /admin) reuse the cached result instead of re-querying Neon.
export const getTrackRecord = unstable_cache(_getTrackRecord, ["track-record"], { revalidate: 300, tags: ["content"] });
export const getTrending = unstable_cache(_getTrending, ["trending"], { revalidate: 300, tags: ["content"] });
