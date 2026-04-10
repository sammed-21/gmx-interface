import { ARBITRUM } from "config/chains";

/**
 * Per-chain list of index token addresses that should appear at the top
 * of market dropdowns when the default (pool-value) sort is active.
 *
 * Order matters — tokens are pinned in the order listed here.
 * To promote a new market, append its index-token address to the relevant chain array.
 */
export const PROMOTED_TOKENS_ORDER: Partial<Record<number, string[]>> = {
  [ARBITRUM]: [
    // BTC
    "0x47904963fc8b2340414262125aF798B9655E58Cd",
    // ETH
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    // SOL
    "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07",
    // XAU (Gold)
    "0x0f16dFBA0242F23F4a5faDE95Cd138139DD7592F",
    // XAG (Silver)
    "0xAc0CeE37770FdC16732C1f591a6B90A4Ea580643",
  ],
};
