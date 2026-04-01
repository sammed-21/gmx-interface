import { test, expect } from "@playwright/experimental-ct-react";

import { SizeConversionStory, SizeConversionMemoStory } from "./useSizeConversion.ct.stories";

test.describe("useSizeConversion", () => {
  test.describe("canConvert flag", () => {
    test("returns false when toToken is undefined", async ({ mount, page }) => {
      await mount(<SizeConversionStory hasToken={false} />);
      await expect(page.getByTestId("can-convert")).toHaveText("false");
    });

    test("returns false when markPrice is undefined", async ({ mount, page }) => {
      await mount(<SizeConversionStory markPriceStr="none" />);
      await expect(page.getByTestId("can-convert")).toHaveText("false");
    });

    test("returns false when markPrice is 0n", async ({ mount, page }) => {
      await mount(<SizeConversionStory markPriceStr="0" />);
      await expect(page.getByTestId("can-convert")).toHaveText("false");
    });

    test("returns true when toToken and markPrice > 0n are present", async ({ mount, page }) => {
      await mount(<SizeConversionStory hasToken={true} markPriceStr="2000" />);
      await expect(page.getByTestId("can-convert")).toHaveText("true");
    });
  });

  test.describe("tokensToUsd", () => {
    test("converts token amount string to USD string", async ({ mount, page }) => {
      // 1.5 ETH at $2000 = $3000
      await mount(<SizeConversionStory tokensInput="1.5" markPriceStr="2000" tokenDecimals={18} />);
      const result = await page.getByTestId("tokens-to-usd").textContent();
      // formatAmount may or may not include commas; check numeric value
      expect(result!.replace(/,/g, "")).toBe("3000.00");
    });

    test('returns "" when canConvert is false', async ({ mount, page }) => {
      await mount(<SizeConversionStory hasToken={false} tokensInput="1.5" />);
      await expect(page.getByTestId("tokens-to-usd")).toHaveText("");
    });

    test('returns "" when input cannot be parsed', async ({ mount, page }) => {
      await mount(<SizeConversionStory tokensInput="abc" />);
      await expect(page.getByTestId("tokens-to-usd")).toHaveText("");
    });

    test("handles visualMultiplier > 1 correctly", async ({ mount, page }) => {
      // With visualMultiplier=10, "1.5" tokens → parsedTokens * 10 * $2000 = $30,000
      await mount(
        <SizeConversionStory tokensInput="1.5" markPriceStr="2000" tokenDecimals={18} visualMultiplier={10} />
      );
      const result = await page.getByTestId("tokens-to-usd").textContent();
      expect(result!.replace(/,/g, "")).toBe("30000.00");
    });

    test("handles 6 decimal tokens (USDC-like)", async ({ mount, page }) => {
      // 1000 USDC at $1 = $1000
      await mount(<SizeConversionStory tokensInput="1000" markPriceStr="1" tokenDecimals={6} />);
      const result = await page.getByTestId("tokens-to-usd").textContent();
      expect(result!.replace(/,/g, "")).toBe("1000.00");
    });

    test("handles very large token amounts", async ({ mount, page }) => {
      await mount(<SizeConversionStory tokensInput="999999" markPriceStr="2000" tokenDecimals={18} />);
      const result = await page.getByTestId("tokens-to-usd").textContent();
      expect(result).toBeTruthy();
      expect(result).not.toBe("");
    });

    test("handles very small dust amounts", async ({ mount, page }) => {
      await mount(<SizeConversionStory tokensInput="0.00000001" markPriceStr="2000" tokenDecimals={18} />);
      const result = await page.getByTestId("tokens-to-usd").textContent();
      expect(result).toBeDefined();
    });
  });

  test.describe("usdToTokens", () => {
    test("converts USD string to token amount string", async ({ mount, page }) => {
      // $3000 at $2000/ETH = 1.5 ETH
      await mount(<SizeConversionStory usdInput="3000" markPriceStr="2000" tokenDecimals={18} />);
      await expect(page.getByTestId("usd-to-tokens")).toHaveText("1.5");
    });

    test('returns "" when canConvert is false', async ({ mount, page }) => {
      await mount(<SizeConversionStory hasToken={false} usdInput="3000" />);
      await expect(page.getByTestId("usd-to-tokens")).toHaveText("");
    });

    test('treats empty string as "0"', async ({ mount, page }) => {
      await mount(<SizeConversionStory usdInput="" markPriceStr="2000" tokenDecimals={18} />);
      await expect(page.getByTestId("usd-to-tokens")).toHaveText("0");
    });

    test("respects TOKEN_INPUT_DISPLAY_DECIMALS (8) precision", async ({ mount, page }) => {
      // $1 at $3 per token = 0.33333333... should be truncated to 8 decimals
      await mount(<SizeConversionStory usdInput="1" markPriceStr="3" tokenDecimals={18} />);
      const result = await page.getByTestId("usd-to-tokens").textContent();
      const parts = result!.split(".");
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(8);
      }
    });

    test("handles visualMultiplier in formatting", async ({ mount, page }) => {
      await mount(<SizeConversionStory usdInput="3000" markPriceStr="2000" tokenDecimals={18} visualMultiplier={10} />);
      const result = await page.getByTestId("usd-to-tokens").textContent();
      expect(result).toBeTruthy();
      expect(result).not.toBe("");
    });
  });

  test.describe("Memoization", () => {
    test("returns stable references when inputs don't change", async ({ mount, page }) => {
      await mount(<SizeConversionMemoStory />);

      // On initial render, refs match current values
      await expect(page.getByTestId("is-stable")).toHaveText("true");
      await expect(page.getByTestId("can-convert")).toHaveText("true");

      // Re-render with unrelated state change — references should stay stable
      await page.getByTestId("rerender-btn").click();
      await expect(page.getByTestId("render-count")).toHaveText("1");
      await expect(page.getByTestId("is-stable")).toHaveText("true");
    });
  });
});
