// Mirrors actions.ts / scripts/config_loader.py. The engine re-validates, so these are for the UI.
export const ASSET_CLASSES = ["crypto", "equity", "fx", "futures", "index", "commodity"];
export const SESSION_PROFILES = ["crypto_24_7", "fx_spot", "us_equity_rth", "cme_futures"];
export const CADENCES = ["daily", "weekday", "trading_day", "weekday_or_market_open", "weekly", "monthly"];
export const FORECAST_WINDOWS = ["rolling_24h", "next_liquid_session", "next_regular_session", "next_session", "next_week", "next_5_sessions"];
export const REPORT_TIERS = ["official", "watchlist", "staged", "backtest"];
// Human labels for the forecast-window enums shown on the horizon chips (enum kept in the tooltip).
export const HORIZON_LABELS: Record<string, string> = {
  rolling_24h: "Next 24 hours", next_liquid_session: "Next liquid session",
  next_regular_session: "Next regular session", next_session: "Next session",
  next_week: "Next week", next_5_sessions: "Next 5 sessions",
};
export const TIMEZONES = [
  "UTC", "Europe/London", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Tokyo", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Australia/Sydney",
];
// Sensible engine defaults per asset class. When you pick a class on a NEW asset these prefill the
// Advanced (session/timing) fields, so a non-expert never has to touch session/window math. They
// stay fully editable in Advanced, and editing an existing asset never overwrites its real settings.
export const CLASS_DEFAULTS: Record<string, { sessionProfile: string; cadence: string; timezone: string; forecastWindow: string; rollUtc: number }> = {
  crypto:    { sessionProfile: "crypto_24_7",   cadence: "daily",                  timezone: "UTC",              forecastWindow: "rolling_24h",          rollUtc: 22 },
  equity:    { sessionProfile: "us_equity_rth", cadence: "trading_day",            timezone: "America/New_York", forecastWindow: "next_regular_session", rollUtc: 0 },
  index:     { sessionProfile: "us_equity_rth", cadence: "trading_day",            timezone: "America/New_York", forecastWindow: "next_regular_session", rollUtc: 0 },
  fx:        { sessionProfile: "fx_spot",       cadence: "daily",                  timezone: "UTC",              forecastWindow: "next_liquid_session",  rollUtc: 22 },
  commodity: { sessionProfile: "fx_spot",       cadence: "weekday_or_market_open", timezone: "UTC",              forecastWindow: "next_liquid_session",  rollUtc: 22 },
  futures:   { sessionProfile: "cme_futures",   cadence: "weekday_or_market_open", timezone: "America/Chicago",  forecastWindow: "next_session",         rollUtc: 22 },
};

export type Form = {
  id: string; name: string; instrument: string; ticker: string; yahoo: string; eodhd: string;
  assetClass: string; sessionProfile: string; cadence: string; timezone: string;
  rollUtc: number; related: string; forecastWindow: string; publishPolicy: string;
  reportTier: string; enabled: boolean;
  cadenceDay: string; timeframes: string[]; chartIntervals: string[];
  includeFundamentals: boolean; includeNews: boolean;
  fundamentalsSource: string;
};
export const BLANK: Form = {
  id: "", name: "", instrument: "", ticker: "", yahoo: "", eodhd: "", assetClass: "crypto",
  sessionProfile: "crypto_24_7", cadence: "daily", timezone: "UTC", rollUtc: 22, related: "",
  forecastWindow: "rolling_24h", publishPolicy: "approval_required", reportTier: "official",
  enabled: true,
  cadenceDay: "", timeframes: [], chartIntervals: [], includeFundamentals: false, includeNews: true,
  fundamentalsSource: "auto",
};
// The candle intervals an asset can be analysed from (mirror of scripts/config_loader.CHART_INTERVALS).
export const CHART_INTERVALS = ["60m", "2h", "4h", "8h", "1d", "1week", "1month"] as const;
