// Per-market UI leverage caps keyed off the contract's `minCollateralFactor`.
// The contracts team runs a cron (see Linear ENG-54) that toggles each market's
// MCF between its on-hours and off-hours value. Matching either sentinel here
// lets the UI apply the correct cap without knowing the session schedule.

export type MarketHoursConfig = {
  onHoursMcf: bigint;
  onHoursMaxLeverage: number;
  offHoursMcf: bigint;
  offHoursMaxLeverage: number;
};

const GOLD_SILVER_CFG: MarketHoursConfig = {
  onHoursMcf: 9n * 10n ** 27n,
  onHoursMaxLeverage: 100,
  offHoursMcf: 35n * 10n ** 27n,
  offHoursMaxLeverage: 25,
};

export const MARKET_HOURS_MARKETS: Record<string, MarketHoursConfig> = {
  // Arbitrum
  "0x0Df2BE76F517BCF0000AbfFcB6344B3b2aC4Cc4f": GOLD_SILVER_CFG, // GOLD/USD
  "0x448Fa722717df299ee197E2F6d8EB7911EFF6cEc": GOLD_SILVER_CFG, // SILVER/USD
};
