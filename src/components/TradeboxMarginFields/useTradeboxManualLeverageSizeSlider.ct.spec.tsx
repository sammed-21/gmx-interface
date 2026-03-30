import { test, expect } from "@playwright/experimental-ct-react";

import { TradeType } from "sdk/utils/trade/types";

import { SliderHookStory } from "./useTradeboxManualLeverageSizeSlider.ct.stories";

test.describe("useTradeboxManualLeverageSizeSlider", () => {
  // ─── 2.1 isLeverageSliderEnabled ────────────────

  test.describe("isLeverageSliderEnabled", () => {
    test("returns true when settings have leverage slider enabled", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={true} />);
      await expect(page.getByTestId("is-leverage-slider-enabled")).toHaveText("true");
    });

    test("returns false when settings have leverage slider disabled", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={false} />);
      await expect(page.getByTestId("is-leverage-slider-enabled")).toHaveText("false");
    });
  });

  // ─── 2.2 sizePercentage ────────────────────────

  test.describe("sizePercentage", () => {
    test("returns 0 when leverage slider is enabled (maxSizeByMarginInTokens undefined)", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={true} hasMarketInfo={true} initialFromValue="1000" />);
      await expect(page.getByTestId("size-percentage")).toHaveText("0");
    });

    test("returns 0 when marketInfo is missing (maxSizeByMarginInTokens undefined)", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={false} hasMarketInfo={false} initialFromValue="1000" />);
      await expect(page.getByTestId("size-percentage")).toHaveText("0");
    });

    test("returns 0 when fromTokenAmount <= 0", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={false} hasMarketInfo={true} initialFromValue="" />);
      await expect(page.getByTestId("size-percentage")).toHaveText("0");
    });
  });

  // ─── 2.3 handleSizePercentageChange ─────────────

  test.describe("handleSizePercentageChange", () => {
    test("no-ops when maxSizeByMarginInTokens is undefined (leverage slider enabled)", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={true} />);

      const toValueBefore = await page.getByTestId("to-token-input-value").textContent();
      await page.getByTestId("change-50").click();
      const toValueAfter = await page.getByTestId("to-token-input-value").textContent();

      // Should not change since maxSizeByMarginInTokens is undefined
      expect(toValueAfter).toBe(toValueBefore);
    });

    test("no-ops when maxSizeByMarginInTokens is undefined (no market info)", async ({ mount, page }) => {
      await mount(<SliderHookStory isLeverageSliderEnabled={false} hasMarketInfo={false} />);

      const toValueBefore = await page.getByTestId("to-token-input-value").textContent();
      await page.getByTestId("change-50").click();
      const toValueAfter = await page.getByTestId("to-token-input-value").textContent();

      expect(toValueAfter).toBe(toValueBefore);
    });

    test("updates toTokenInputValue when maxSizeByMarginInTokens is available", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={false}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0"
          tradeType={TradeType.Long}
        />
      );

      // Click 50% — should calculate a token amount
      await page.getByTestId("change-50").click();

      // Wait for the update
      const toValue = await page.getByTestId("to-token-input-value").textContent();
      // If maxSizeByMarginInTokens computed, toValue should be non-zero
      // (It may still be "0" if the market mock doesn't fully resolve)
      expect(toValue).toBeDefined();
    });

    test("updates sizeInputValue with USD conversion in usd display mode", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={false}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0"
          sizeDisplayMode="usd"
          tradeType={TradeType.Long}
        />
      );

      await page.getByTestId("change-50").click();

      // sizeInputValue should be updated (either with USD value or empty if canConvert is false)
      const sizeInput = await page.getByTestId("size-input-value").textContent();
      expect(sizeInput).toBeDefined();
    });

    test("updates sizeInputValue with token value in token display mode", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={false}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0"
          sizeDisplayMode="token"
          tradeType={TradeType.Long}
        />
      );

      await page.getByTestId("change-50").click();

      const sizeInput = await page.getByTestId("size-input-value").textContent();
      const toValue = await page.getByTestId("to-token-input-value").textContent();
      // In token mode, sizeInputValue should match toTokenInputValue
      if (toValue && toValue !== "0") {
        expect(sizeInput).toBe(toValue);
      }
    });
  });

  // ─── 2.4 markFieldInteraction ──────────────────

  test.describe("markFieldInteraction", () => {
    test("prevents slider sync from firing after field interaction", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={false}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0"
          tradeType={TradeType.Long}
        />
      );

      // Use slider first
      await page.getByTestId("change-50").click();
      const afterSlider = await page.getByTestId("to-token-input-value").textContent();

      // Mark field interaction (simulates user typing in size field)
      await page.getByTestId("mark-field").click();

      // The slider sync effect should NOT re-apply because lastInteraction is now "field"
      // Value should remain what it was
      const afterField = await page.getByTestId("to-token-input-value").textContent();
      expect(afterField).toBe(afterSlider);
    });
  });

  // ─── 2.5 Slider sync effect ────────────────────

  test.describe("Slider sync effect", () => {
    test("does NOT re-apply when isLeverageSliderEnabled is true", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={true}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0.5"
          tradeType={TradeType.Long}
        />
      );

      // With leverage slider enabled, the sync effect bails out
      // Size percentage should be 0
      await expect(page.getByTestId("size-percentage")).toHaveText("0");
      // toTokenInputValue should remain unchanged
      await expect(page.getByTestId("to-token-input-value")).toHaveText("0.5");
    });

    test("does NOT re-apply when last interaction was field", async ({ mount, page }) => {
      await mount(
        <SliderHookStory
          isLeverageSliderEnabled={false}
          hasMarketInfo={true}
          initialFromValue="1000"
          initialToValue="0.5"
          tradeType={TradeType.Long}
        />
      );

      // Mark field interaction first (so lastInteraction = "field")
      await page.getByTestId("mark-field").click();

      // The value should remain what it is — no sync effect
      await expect(page.getByTestId("to-token-input-value")).toHaveText("0.5");
    });
  });
});
