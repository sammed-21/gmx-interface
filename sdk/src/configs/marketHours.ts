// UI leverage caps for market-hours (GOLD/SILVER) markets.
// The contract reports the current session via minCollateralFactor.
//   on-hours:  MCF 0.009 (9e27)  → 100x UI
//   off-hours: MCF 0.035 (35e27) → 25x UI
export const MARKET_HOURS_MCF_ON_HOURS = 9n * 10n ** 27n;
export const MARKET_HOURS_MCF_OFF_HOURS = 35n * 10n ** 27n;

export const MARKET_HOURS_MARKETS = new Set([
  // Arbitrum
  "0x0Df2BE76F517BCF0000AbfFcB6344B3b2aC4Cc4f", // GOLD/USD
  "0x448Fa722717df299ee197E2F6d8EB7911EFF6cEc", // SILVER/USD
]);
