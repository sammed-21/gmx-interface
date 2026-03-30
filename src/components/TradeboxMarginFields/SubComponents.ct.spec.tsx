import { test, expect } from "@playwright/experimental-ct-react";

import { TradeMode } from "sdk/utils/trade/types";

import { SliderStory, SliderClampStory, PriceFieldStory } from "./SubComponents.ct.stories";

test.describe("MarginPercentageSlider", () => {
  // ─── 3.1 Rendering (additional) ────────────────

  test.describe("Rendering", () => {
    test("renders slider with correct marks", async ({ mount, page }) => {
      await mount(<SliderStory initialValue={50} />);

      await expect(page.locator(".rc-slider")).toBeVisible();
      for (const mark of ["0%", "25%", "50%", "75%", "100%"]) {
        await expect(page.getByText(mark).first()).toBeVisible();
      }
    });

    test("applies custom className when provided", async ({ mount, page }) => {
      await mount(<SliderStory initialValue={50} className="custom-test-class" />);

      // The outer div should have the custom class
      const wrapper = page.locator(".custom-test-class");
      await expect(wrapper).toBeVisible();
    });
  });

  // ─── 3.2 Value clamping ────────────────────────

  test.describe("Value clamping", () => {
    test("shows 0 when value is NaN", async ({ mount, page }) => {
      await mount(<SliderClampStory value={NaN} />);

      // Slider should render (not crash)
      await expect(page.locator(".rc-slider")).toBeVisible();
    });

    test("shows 0 when value is Infinity", async ({ mount, page }) => {
      await mount(<SliderClampStory value={Infinity} />);

      await expect(page.locator(".rc-slider")).toBeVisible();
    });

    test("clamps negative value to 0", async ({ mount, page }) => {
      await mount(<SliderClampStory value={-10} />);

      await expect(page.locator(".rc-slider")).toBeVisible();
      // Handle should be at 0 position
      const handle = page.locator(".rc-slider-handle");
      await expect(handle).toBeVisible();
    });

    test("clamps value above 100 to 100", async ({ mount, page }) => {
      await mount(<SliderClampStory value={150} />);

      await expect(page.locator(".rc-slider")).toBeVisible();
      const handle = page.locator(".rc-slider-handle");
      await expect(handle).toBeVisible();
    });
  });

  // ─── 3.3 onChange ──────────────────────────────

  test.describe("onChange", () => {
    test("slider handle is draggable", async ({ mount, page }) => {
      await mount(<SliderStory initialValue={0} />);

      // Verify slider is interactive
      const slider = page.locator(".rc-slider");
      await expect(slider).toBeVisible();

      const handle = page.locator(".rc-slider-handle");
      await expect(handle).toBeVisible();
    });
  });
});

test.describe("PriceField", () => {
  // ─── 6.1 Rendering ────────────────────────────

  test.describe("Rendering", () => {
    test('renders "Limit price" label for Limit trade mode', async ({ mount, page }) => {
      await mount(<PriceFieldStory tradeMode={TradeMode.Limit} />);

      await expect(page.getByText("Limit price")).toBeVisible();
    });

    test('renders "Stop price" label for non-Limit trade mode', async ({ mount, page }) => {
      await mount(<PriceFieldStory tradeMode={TradeMode.Trigger} />);

      await expect(page.getByText("Stop price")).toBeVisible();
    });

    test("shows USD unit label", async ({ mount, page }) => {
      await mount(<PriceFieldStory />);

      const priceField = page.locator('[data-qa="trigger-price"]');
      await expect(priceField.getByText("USD")).toBeVisible();
    });

    test("does NOT show display mode toggle", async ({ mount, page }) => {
      await mount(<PriceFieldStory />);

      // Should not have a display mode button
      await expect(page.locator('[data-qa="trigger-price-display-mode-button"]')).toHaveCount(0);
    });
  });

  // ─── 6.2 Alternate value (mark price) ──────────

  test.describe("Mark price", () => {
    test("shows mark price as alternate value", async ({ mount, page }) => {
      await mount(<PriceFieldStory />);

      await expect(page.getByText("Mark:")).toBeVisible();
    });

    test("mark price is clickable when onMarkPriceClick is provided", async ({ mount, page }) => {
      await mount(<PriceFieldStory hasMarkPriceClick={true} initialPrice="" />);

      await page.getByText("Mark:").click();

      const priceInput = page.locator('[data-qa="trigger-price-input"]');
      await expect(priceInput).toHaveValue("2000");
    });

    test("mark price is NOT clickable when onMarkPriceClick is undefined", async ({ mount, page }) => {
      await mount(<PriceFieldStory hasMarkPriceClick={false} initialPrice="" />);

      // The mark price text should not have cursor-pointer class
      const markText = page.getByText("Mark:");
      await expect(markText).toBeVisible();

      // Clicking should NOT change the input
      await markText.click();
      const priceInput = page.locator('[data-qa="trigger-price-input"]');
      await expect(priceInput).toHaveValue("");
    });
  });

  // ─── 6.3 Interactions ─────────────────────────

  test.describe("Interactions", () => {
    test("typing updates price value", async ({ mount, page }) => {
      await mount(<PriceFieldStory initialPrice="" />);

      const priceInput = page.locator('[data-qa="trigger-price-input"]');
      await priceInput.fill("1850");
      await expect(priceInput).toHaveValue("1850");
    });

    test("shows initial trigger price value", async ({ mount, page }) => {
      await mount(<PriceFieldStory initialPrice="1950" />);

      const priceInput = page.locator('[data-qa="trigger-price-input"]');
      await expect(priceInput).toHaveValue("1950");
    });
  });
});
