import { zeroAddress } from "viem";

import { ARBITRUM } from "config/chains";

/**
 * Per-chain list of index token addresses that should appear at the top
 * of market dropdowns when the default (pool-value) sort is active.
 *
 * Order matters — tokens are pinned in the order listed here.
 * To promote a new market, append its index-token address to the relevant chain array.
 * Use the native/unwrapped form of the address (e.g. zeroAddress for ETH, not WETH).
 */
export const PROMOTED_TOKENS_ORDER: Partial<Record<number, string[]>> = {
  [ARBITRUM]: [
    // BTC
    "0x47904963fc8b2340414262125aF798B9655E58Cd",
    // ETH (native address, not WETH)
    zeroAddress,
    // SOL
    "0x2bcC6D6CdBbDC0a4071e48bb3B969b06B3330c07",
    // GOLD
    "0xc48d782c5C54157d37d2Fa4E6BA27E8cf57Da956",
    // SILVER
    "0xE41902f9aD379A8CC34A34efa00F5c3EE5112bC8",
  ],
};
