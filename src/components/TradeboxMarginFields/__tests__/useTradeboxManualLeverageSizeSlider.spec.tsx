import { act, render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ARBITRUM } from "config/chains";
import type { SyntheticsState } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { StateCtx } from "context/SyntheticsStateContext/utils";
import { expandDecimals, PRECISION } from "lib/numbers";
import type { DeepPartial } from "lib/types";
import type { MarketInfo } from "sdk/utils/markets/types";
import type { TokenData } from "sdk/utils/tokens/types";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { useTradeboxManualLeverageSizeSlider } from "../useTradeboxManualLeverageSizeSlider";

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const MARKET_ADDRESS = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

const USDC_TOKEN = {
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
  address: USDC_ADDRESS,
  isStable: true,
  prices: { minPrice: expandDecimals(1, 30), maxPrice: expandDecimals(1, 30) },
  balance: expandDecimals(10000, 6),
} as TokenData;

const ETH_TOKEN = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  address: ETH_ADDRESS,
  prices: { minPrice: expandDecimals(2000, 30), maxPrice: expandDecimals(2000, 30) },
  balance: expandDecimals(10, 18),
} as TokenData;

const TOKENS_DATA = { [USDC_ADDRESS]: USDC_TOKEN, [ETH_ADDRESS]: ETH_TOKEN };

function createMarketInfo(): MarketInfo {
  return {
    marketTokenAddress: MARKET_ADDRESS,
    indexTokenAddress: ETH_ADDRESS,
    longTokenAddress: ETH_ADDRESS,
    shortTokenAddress: USDC_ADDRESS,
    isSameCollaterals: false,
    isSpotOnly: false,
    name: "ETH/USD [ETH-USDC]",
    data: "",
    isDisabled: false,
    longToken: ETH_TOKEN,
    shortToken: USDC_TOKEN,
    indexToken: ETH_TOKEN,
    longPoolAmount: expandDecimals(1000, 18),
    shortPoolAmount: expandDecimals(2000000, 6),
    maxLongPoolAmount: expandDecimals(10000, 18),
    maxShortPoolAmount: expandDecimals(20000000, 6),
    maxLongPoolUsdForDeposit: expandDecimals(20000000, 30),
    maxShortPoolUsdForDeposit: expandDecimals(20000000, 30),
    poolValueMax: expandDecimals(4000000, 30),
    poolValueMin: expandDecimals(3900000, 30),
    reserveFactorLong: expandDecimals(5, 29),
    reserveFactorShort: expandDecimals(5, 29),
    openInterestReserveFactorLong: expandDecimals(5, 29),
    openInterestReserveFactorShort: expandDecimals(5, 29),
    maxOpenInterestLong: expandDecimals(10000000, 30),
    maxOpenInterestShort: expandDecimals(10000000, 30),
    borrowingFactorLong: 0n,
    borrowingFactorShort: 0n,
    borrowingExponentFactorLong: expandDecimals(1, 30),
    borrowingExponentFactorShort: expandDecimals(1, 30),
    fundingFactor: expandDecimals(1, 25),
    fundingExponentFactor: expandDecimals(1, 30),
    fundingIncreaseFactorPerSecond: 0n,
    fundingDecreaseFactorPerSecond: 0n,
    thresholdForStableFunding: 0n,
    thresholdForDecreaseFunding: 0n,
    minFundingFactorPerSecond: 0n,
    maxFundingFactorPerSecond: 0n,
    totalBorrowingFees: 0n,
    positionImpactPoolAmount: expandDecimals(100, 18),
    minPositionImpactPoolAmount: 0n,
    positionImpactPoolDistributionRate: 0n,
    minCollateralFactor: PRECISION / 100n,
    minCollateralFactorForLiquidation: PRECISION / 200n,
    minCollateralFactorForOpenInterestLong: 0n,
    minCollateralFactorForOpenInterestShort: 0n,
    swapImpactPoolAmountLong: 0n,
    swapImpactPoolAmountShort: 0n,
    maxPnlFactorForTradersLong: expandDecimals(5, 29),
    maxPnlFactorForTradersShort: expandDecimals(5, 29),
    longInterestUsd: expandDecimals(100000, 30),
    shortInterestUsd: expandDecimals(80000, 30),
    longInterestInTokens: expandDecimals(50, 18),
    shortInterestInTokens: expandDecimals(40, 18),
    positionFeeFactorForBalanceWasImproved: expandDecimals(5, 25),
    positionFeeFactorForBalanceWasNotImproved: expandDecimals(7, 25),
    positionImpactFactorPositive: expandDecimals(1, 25),
    positionImpactFactorNegative: expandDecimals(2, 25),
    maxPositionImpactFactorPositive: expandDecimals(1, 28),
    maxPositionImpactFactorNegative: expandDecimals(1, 28),
    maxPositionImpactFactorForLiquidations: expandDecimals(1, 28),
    maxLendableImpactFactor: 0n,
    maxLendableImpactFactorForWithdrawals: 0n,
    maxLendableImpactUsd: 0n,
    lentPositionImpactPoolAmount: 0n,
    positionImpactExponentFactorPositive: expandDecimals(2, 30),
    positionImpactExponentFactorNegative: expandDecimals(2, 30),
    useOpenInterestInTokensForBalance: true,
    swapFeeFactorForBalanceWasImproved: expandDecimals(5, 25),
    swapFeeFactorForBalanceWasNotImproved: expandDecimals(7, 25),
    atomicSwapFeeFactor: expandDecimals(5, 25),
    swapImpactFactorPositive: expandDecimals(1, 25),
    swapImpactFactorNegative: expandDecimals(2, 25),
    swapImpactExponentFactor: expandDecimals(2, 30),
    borrowingFactorPerSecondForLongs: 0n,
    borrowingFactorPerSecondForShorts: 0n,
    fundingFactorPerSecond: 0n,
    longsPayShorts: true,
    virtualPoolAmountForLongToken: 0n,
    virtualPoolAmountForShortToken: 0n,
    virtualInventoryForPositions: 0n,
    virtualMarketId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    virtualLongTokenId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    virtualShortTokenId: "0x0000000000000000000000000000000000000000000000000000000000000000",
  } as MarketInfo;
}

type StateOpts = {
  isLeverageSliderEnabled?: boolean;
  hasMarketInfo?: boolean;
  fromTokenInputValue?: string;
  toTokenInputValue?: string;
};

function createState(opts: StateOpts = {}): SyntheticsState {
  const {
    isLeverageSliderEnabled = true,
    hasMarketInfo = false,
    fromTokenInputValue = "1000",
    toTokenInputValue = "0.5",
  } = opts;

  const marketInfo = hasMarketInfo ? createMarketInfo() : undefined;

  const state: DeepPartial<SyntheticsState> = {
    pageType: "trade",
    globals: {
      chainId: ARBITRUM,
      srcChainId: undefined,
      tokensDataResult: { tokensData: TOKENS_DATA },
      marketsInfo: { marketsInfoData: hasMarketInfo ? { [MARKET_ADDRESS]: marketInfo } : {} },
      positionsInfo: { positionsInfoData: {} },
      ordersInfo: { ordersInfoData: {} },
      uiFeeFactor: 0n,
      jitLiquidityData: {},
      isFirstOrder: false,
      account: undefined,
    },
    externalSwap: {
      baseOutput: undefined,
      setBaseOutput: () => undefined,
      shouldFallbackToInternalSwap: false,
      setShouldFallbackToInternalSwap: () => undefined,
    },
    claims: { accruedPositionPriceImpactFees: [], claimablePositionPriceImpactFees: [] },
    tradebox: {
      tradeType: TradeType.Long,
      tradeMode: TradeMode.Market,
      fromTokenAddress: USDC_ADDRESS,
      toTokenAddress: ETH_ADDRESS,
      marketAddress: hasMarketInfo ? MARKET_ADDRESS : undefined,
      marketInfo,
      collateralAddress: USDC_ADDRESS,
      collateralToken: USDC_TOKEN,
      focusedInput: "from",
      fromTokenInputValue,
      toTokenInputValue,
      triggerPriceInputValue: "",
      isFromTokenGmxAccount: false,
      leverageOption: 20000,
      availableTokensOptions: {
        swapTokens: [USDC_TOKEN, ETH_TOKEN],
        infoTokens: TOKENS_DATA,
        sortedLongAndShortTokens: [ETH_ADDRESS],
      },
    },
    settings: { isLeverageSliderEnabled },
  };

  return state as SyntheticsState;
}

/** Test harness that renders hook output as data attributes */
function HookHarness({
  state,
  setTo,
  setSize,
  actionsRef,
}: {
  state: SyntheticsState;
  setTo: (v: string, r: boolean) => void;
  setSize: (v: string) => void;
  actionsRef: React.MutableRefObject<ReturnType<typeof useTradeboxManualLeverageSizeSlider> | null>;
}) {
  return (
    <StateCtx.Provider value={state}>
      <Inner setTo={setTo} setSize={setSize} actionsRef={actionsRef} />
    </StateCtx.Provider>
  );
}

function Inner({
  setTo,
  setSize,
  actionsRef,
}: {
  setTo: (v: string, r: boolean) => void;
  setSize: (v: string) => void;
  actionsRef: React.MutableRefObject<ReturnType<typeof useTradeboxManualLeverageSizeSlider> | null>;
}) {
  const result = useTradeboxManualLeverageSizeSlider({
    sizeDisplayMode: "usd",
    canConvert: true,
    tokensToUsd: (v) => v,
    setSizeInputValue: setSize,
    setToTokenInputValue: setTo,
  });

  actionsRef.current = result;

  return (
    <div>
      <span data-testid="enabled">{String(result.isLeverageSliderEnabled)}</span>
      <span data-testid="pct">{result.sizePercentage}</span>
    </div>
  );
}

function setup(opts: StateOpts = {}) {
  const state = createState(opts);
  const setTo = vi.fn();
  const setSize = vi.fn();
  const actionsRef = { current: null } as React.MutableRefObject<ReturnType<
    typeof useTradeboxManualLeverageSizeSlider
  > | null>;

  const utils = render(<HookHarness state={state} setTo={setTo} setSize={setSize} actionsRef={actionsRef} />);

  return { setTo, setSize, actionsRef, ...utils };
}

describe("useTradeboxManualLeverageSizeSlider", () => {
  afterEach(cleanup);

  describe("isLeverageSliderEnabled", () => {
    it("returns true when setting is enabled", () => {
      const { getByTestId } = setup({ isLeverageSliderEnabled: true });
      expect(getByTestId("enabled").textContent).toBe("true");
    });

    it("returns false when setting is disabled", () => {
      const { getByTestId } = setup({ isLeverageSliderEnabled: false });
      expect(getByTestId("enabled").textContent).toBe("false");
    });
  });

  describe("sizePercentage", () => {
    it("returns 0 when leverage slider is enabled", () => {
      const { getByTestId } = setup({ isLeverageSliderEnabled: true, hasMarketInfo: true });
      expect(getByTestId("pct").textContent).toBe("0");
    });

    it("returns 0 when marketInfo is missing", () => {
      const { getByTestId } = setup({ isLeverageSliderEnabled: false, hasMarketInfo: false });
      expect(getByTestId("pct").textContent).toBe("0");
    });

    it("returns 0 when fromTokenAmount <= 0", () => {
      const { getByTestId } = setup({
        isLeverageSliderEnabled: false,
        hasMarketInfo: true,
        fromTokenInputValue: "",
      });
      expect(getByTestId("pct").textContent).toBe("0");
    });
  });

  describe("handleSizePercentageChange", () => {
    it("no-ops when leverage slider is enabled", () => {
      const { setTo, actionsRef } = setup({ isLeverageSliderEnabled: true });
      act(() => actionsRef.current!.handleSizePercentageChange(50));
      expect(setTo).not.toHaveBeenCalled();
    });

    it("no-ops when no market info", () => {
      const { setTo, actionsRef } = setup({ isLeverageSliderEnabled: false, hasMarketInfo: false });
      act(() => actionsRef.current!.handleSizePercentageChange(50));
      expect(setTo).not.toHaveBeenCalled();
    });

    it("sets toTokenInputValue when market info is available", () => {
      const { setTo, actionsRef } = setup({
        isLeverageSliderEnabled: false,
        hasMarketInfo: true,
        fromTokenInputValue: "1000",
        toTokenInputValue: "0",
      });
      act(() => actionsRef.current!.handleSizePercentageChange(50));
      expect(setTo).toHaveBeenCalled();
      expect(Number(setTo.mock.calls[0][0])).toBeGreaterThan(0);
    });

    it("100% yields larger size than 50%", () => {
      const { setTo, actionsRef } = setup({
        isLeverageSliderEnabled: false,
        hasMarketInfo: true,
        fromTokenInputValue: "1000",
        toTokenInputValue: "0",
      });

      act(() => actionsRef.current!.handleSizePercentageChange(50));
      const size50 = Number(setTo.mock.calls[0][0]);

      act(() => actionsRef.current!.handleSizePercentageChange(100));
      const size100 = Number(setTo.mock.calls[1][0]);

      expect(size100).toBeGreaterThan(size50);
    });
  });

  describe("markFieldInteraction", () => {
    it("prevents additional slider sync calls", () => {
      const { setTo, actionsRef } = setup({
        isLeverageSliderEnabled: false,
        hasMarketInfo: true,
        fromTokenInputValue: "1000",
        toTokenInputValue: "0",
      });

      act(() => actionsRef.current!.handleSizePercentageChange(50));
      const callsAfterSlider = setTo.mock.calls.length;

      act(() => actionsRef.current!.markFieldInteraction());

      expect(setTo.mock.calls.length).toBe(callsAfterSlider);
    });
  });
});
