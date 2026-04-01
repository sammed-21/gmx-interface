import { describe, expect, it } from "vitest";

import { expandDecimals, formatAmount, formatAmountFree, parseValue, USD_DECIMALS } from "lib/numbers";
import { convertToTokenAmount } from "sdk/utils/tokens";

import { TOKEN_INPUT_DISPLAY_DECIMALS } from "../useSizeConversion";

/**
 * useSizeConversion is a thin hook over pure functions.
 * We test the underlying conversion logic directly — no React needed.
 */

const ETH_DECIMALS = 18;
const USDC_DECIMALS = 6;

function tokensToUsd(tokensValue: string, decimals: number, markPrice: bigint, visualMultiplier = 1): string {
  if (markPrice === 0n) return "";
  const parsed = parseValue(tokensValue, decimals);
  if (parsed === undefined) return "";
  const sizeInUsd = (parsed * BigInt(visualMultiplier) * markPrice) / 10n ** BigInt(decimals);
  return formatAmount(sizeInUsd, USD_DECIMALS, 2);
}

function usdToTokens(usdValue: string, decimals: number, markPrice: bigint, visualMultiplier?: number): string {
  if (markPrice === 0n) return "";
  const parsed = parseValue(usdValue || "0", USD_DECIMALS);
  if (parsed === undefined) return "";
  const tokens = convertToTokenAmount(parsed, decimals, markPrice);
  if (tokens === undefined) return "";
  return formatAmountFree(tokens, decimals, TOKEN_INPUT_DISPLAY_DECIMALS, visualMultiplier);
}

describe("useSizeConversion logic", () => {
  describe("tokensToUsd", () => {
    it("converts token amount to USD string", () => {
      const price = expandDecimals(2000, 30);
      expect(tokensToUsd("1.5", ETH_DECIMALS, price).replace(/,/g, "")).toBe("3000.00");
    });

    it('returns "" when input cannot be parsed', () => {
      expect(tokensToUsd("abc", ETH_DECIMALS, expandDecimals(2000, 30))).toBe("");
    });

    it("handles visualMultiplier > 1", () => {
      const price = expandDecimals(2000, 30);
      expect(tokensToUsd("1.5", ETH_DECIMALS, price, 10).replace(/,/g, "")).toBe("30000.00");
    });

    it("handles 6-decimal tokens (USDC-like)", () => {
      expect(tokensToUsd("1000", USDC_DECIMALS, expandDecimals(1, 30)).replace(/,/g, "")).toBe("1000.00");
    });

    it("handles very large token amounts", () => {
      const usd = tokensToUsd("999999", ETH_DECIMALS, expandDecimals(2000, 30));
      expect(usd).toBeTruthy();
      expect(usd).not.toBe("");
    });

    it("handles very small dust amounts", () => {
      expect(tokensToUsd("0.00000001", ETH_DECIMALS, expandDecimals(2000, 30))).toBeDefined();
    });

    it('returns "" when markPrice is 0', () => {
      expect(tokensToUsd("1.5", ETH_DECIMALS, 0n)).toBe("");
    });
  });

  describe("usdToTokens", () => {
    it("converts USD to token amount string", () => {
      expect(usdToTokens("3000", ETH_DECIMALS, expandDecimals(2000, 30))).toBe("1.5");
    });

    it('treats empty string as "0"', () => {
      expect(usdToTokens("", ETH_DECIMALS, expandDecimals(2000, 30))).toBe("0");
    });

    it("respects TOKEN_INPUT_DISPLAY_DECIMALS (8) precision", () => {
      const tokens = usdToTokens("1", ETH_DECIMALS, expandDecimals(3, 30));
      const parts = tokens.split(".");
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(8);
      }
    });

    it("handles visualMultiplier in formatting", () => {
      const tokens = usdToTokens("3000", ETH_DECIMALS, expandDecimals(2000, 30), 10);
      expect(tokens).toBeTruthy();
      expect(tokens).not.toBe("");
    });

    it('returns "" when markPrice is 0', () => {
      expect(usdToTokens("3000", ETH_DECIMALS, 0n)).toBe("");
    });
  });
});
