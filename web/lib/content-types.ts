export type Edition = {
  date: string; slug: string; instrument: string; ticker: string;
  assetClass: string; status: string; risk: string; bias: string;
  lastPrice: string; dataQuality: string | number; windowEnd: string;
  reportDate: string; catalystStatus: string;
  freeHtml: string; freePdf: string; preview: string; hasPro: boolean; hidden: boolean;
  confidence?: number | null; // research confidence (0–100), joined from the open call
  // Cadence + intervals (additive; present on DB rows with the columns and in the JSON catalog).
  reportId?: string; scoredCadence?: string; chartIntervals?: string[]; forecastWindow?: string;
  // Data-license provenance (additive; nullable editions columns). Tolerate NULL/undefined.
  dataProvider?: string; dataLicense?: string; dataLicenseDegraded?: boolean;
};

export type SubCall = {
  id: string; type: string; text: string; manual: boolean; expect?: boolean | null;
  // Per-prediction outcome merged from the ledger's packed results ("Y"|"N"|"NT"|""),
  // and the edition-level prediction archetype. Optional so DB + JSON shapes both satisfy.
  verdict?: string; predType?: string;
};
export type OpenCall = {
  reportId: string; instrument: string; symbol: string; view: string;
  confidence: string | number; windowEnd: string; n: number; nManual: number;
  hits: number; scored: boolean; // tracker: hits/n, scored flips true after the engine reruns
  predictions: SubCall[];
  horizon?: string; // multi-timeframe horizon, derived from the report_id tag
  scoredCadence?: string; // daily | weekly | monthly, derived from the report_id period stamp
};
export type ScoredRow = {
  instrument: string; view: string; confidence: string | number;
  results: string; hitRate: string | number; windowEnd: string;
  // Present in the JSON-fallback rows (written by export_content.py) and read by sync-db;
  // not selected on the DB path. Optional so both shapes satisfy the type.
  reportId?: string; hits?: string | number; misses?: string | number;
  // Normalized taxonomy fields (JSON-fallback + DB where columns exist).
  assetClass?: string; predType?: string;
  horizon?: string; // multi-timeframe horizon, derived from the report_id tag
  scoredCadence?: string; // daily | weekly | monthly, the scoring period
};

// ---- Derived track-record analytics (Task T12). All additive; empty arrays when the
// ledger is empty, so consumers must tolerate [] / undefined and never assume presence.
export type InstrumentPerf = {
  instrument: string; ticker: string; assetClass: string;
  reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type AssetClassPerf = {
  assetClass: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type PredTypePerf = {
  predType: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type RegimePerf = {
  regime: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type HorizonPerf = {
  horizon: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type CadencePerf = {
  cadence: string; reportsScored: number; hits: number; misses: number; hitRate: number | null;
};
export type TimelinePoint = {
  reportId: string; instrument: string; windowEnd: string;
  perReportHitRate: number | null; cumulativeHitRate: number | null;
};
export type CalibrationBin = {
  bucket: string; confLo: number; confHi: number;
  reports: number; hits: number; misses: number; hitRate: number | null;
};
export type ComponentOutcome = {
  band: string; reports: number; avgConfidence: number | null; hitRate: number | null;
};

export type TrackRecord = {
  stats: {
    reportsScored: number; openCalls: number; predictionsGraded: number; hitRate: number | null;
    longestStreak: number; currentStreak: number;
  };
  open: OpenCall[]; scored: ScoredRow[];
  calibration: Record<string, { hitRate: number | null; n: number }> | null;
  // Derived analytics — optional everywhere so older JSON / a DB without the columns degrades.
  byInstrument?: InstrumentPerf[];
  byAssetClass?: AssetClassPerf[];
  byPredictionType?: PredTypePerf[];
  byRegime?: RegimePerf[];
  byHorizon?: HorizonPerf[];
  byCadence?: CadencePerf[];
  timeline?: TimelinePoint[];
  calibrationCurve?: CalibrationBin[];
  componentVsOutcome?: ComponentOutcome[];
};
