import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useCallback, useMemo, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { createConfig, http, WagmiProvider } from "wagmi";
import { arbitrum } from "wagmi/chains";

import { ARBITRUM } from "config/chains";
import type { SyntheticsState } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { StateCtx } from "context/SyntheticsStateContext/utils";
import { expandDecimals, PRECISION } from "lib/numbers";
import type { DeepPartial } from "lib/types";
import type { MarketInfo } from "sdk/utils/markets/types";
import type { TokenData } from "sdk/utils/tokens/types";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { useSizeConversion } from "../useSizeConversion";
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
  prices: {
    minPrice: expandDecimals(1, 30),
    maxPrice: expandDecimals(1, 30),
  },
  balance: expandDecimals(10000, 6),
} as TokenData;

const ETH_TOKEN = {
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  address: ETH_ADDRESS,
  prices: {
    minPrice: expandDecimals(2000, 30),
    maxPrice: expandDecimals(2000, 30),
  },
  balance: expandDecimals(10, 18),
} as TokenData;

const TOKENS_DATA = {
  [USDC_ADDRESS]: USDC_TOKEN,
  [ETH_ADDRESS]: ETH_TOKEN,
};

function createMockMarketInfo(): MarketInfo {
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

    reserveFactorLong: expandDecimals(5, 29), // 0.5
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

    // minCollateralFactor = PRECISION / 100 → max leverage ~50x
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

    positionFeeFactorForBalanceWasImproved: expandDecimals(5, 25), // 0.05%
    positionFeeFactorForBalanceWasNotImproved: expandDecimals(7, 25), // 0.07%
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

type MockStateOverrides = {
  tradeMode?: TradeMode;
  tradeType?: TradeType;
  fromTokenInputValue?: string;
  toTokenInputValue?: string;
  focusedInput?: "from" | "to";
  isLeverageSliderEnabled?: boolean;
  hasMarketInfo?: boolean;
};

function createMockState(overrides: MockStateOverrides = {}): SyntheticsState {
  const {
    tradeMode = TradeMode.Market,
    tradeType = TradeType.Long,
    fromTokenInputValue = "1000",
    toTokenInputValue = "0.5",
    focusedInput = "from",
    isLeverageSliderEnabled = true,
    hasMarketInfo = false,
  } = overrides;

  const marketInfo = hasMarketInfo ? createMockMarketInfo() : undefined;

  const state: DeepPartial<SyntheticsState> = {
    pageType: "trade",
    globals: {
      chainId: ARBITRUM,
      srcChainId: undefined,
      tokensDataResult: { tokensData: TOKENS_DATA },
      marketsInfo: {
        marketsInfoData: hasMarketInfo ? { [MARKET_ADDRESS]: marketInfo } : {},
      },
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
    claims: {
      accruedPositionPriceImpactFees: [],
      claimablePositionPriceImpactFees: [],
    },
    tradebox: {
      tradeType,
      tradeMode,
      fromTokenAddress: USDC_ADDRESS,
      toTokenAddress: ETH_ADDRESS,
      marketAddress: hasMarketInfo ? MARKET_ADDRESS : undefined,
      marketInfo,
      collateralAddress: USDC_ADDRESS,
      collateralToken: USDC_TOKEN,
      focusedInput,
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
    settings: {
      isLeverageSliderEnabled,
    },
  };

  return state as SyntheticsState;
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: { [arbitrum.id]: http() },
});

function TestProviders({ state, children }: { state: SyntheticsState; children: ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <RainbowKitProvider>
            <I18nProvider i18n={i18n}>
              <StateCtx.Provider value={state}>{children}</StateCtx.Provider>
            </I18nProvider>
          </RainbowKitProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

export type SliderHookStoryProps = {
  isLeverageSliderEnabled?: boolean;
  hasMarketInfo?: boolean;
  initialFromValue?: string;
  initialToValue?: string;
  tradeType?: TradeType;
  sizeDisplayMode?: "usd" | "token";
};

/**
 * Wrapper component that calls useTradeboxManualLeverageSizeSlider
 * and exposes its outputs as data attributes for Playwright assertions.
 * Also provides buttons to trigger hook callbacks.
 */
export function SliderHookStory({
  isLeverageSliderEnabled = true,
  hasMarketInfo = false,
  initialFromValue = "1000",
  initialToValue = "0.5",
  tradeType = TradeType.Long,
  sizeDisplayMode: initialDisplayMode = "usd",
}: SliderHookStoryProps) {
  const [sizeDisplayMode, setSizeDisplayMode] = useState<"usd" | "token">(initialDisplayMode);
  const [sizeInputValue, setSizeInputValue] = useState("");
  const [toTokenInputValue, setToTokenInputValue] = useState(initialToValue);

  const state = useMemo(
    () =>
      createMockState({
        isLeverageSliderEnabled,
        hasMarketInfo,
        fromTokenInputValue: initialFromValue,
        toTokenInputValue,
        tradeType,
      }),
    [isLeverageSliderEnabled, hasMarketInfo, initialFromValue, toTokenInputValue, tradeType]
  );

  // We need useSizeConversion for the tokensToUsd callback
  const markPrice = expandDecimals(2000, 30);
  const { tokensToUsd, canConvert } = useSizeConversion({
    toToken: ETH_TOKEN,
    markPrice,
  });

  const setToTokenInputValueCb = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToTokenInputValue(value);
  }, []);

  return (
    <TestProviders state={state}>
      <SliderHookInner
        sizeDisplayMode={sizeDisplayMode}
        canConvert={canConvert}
        tokensToUsd={tokensToUsd}
        setSizeInputValue={setSizeInputValue}
        setToTokenInputValue={setToTokenInputValueCb}
        sizeInputValue={sizeInputValue}
        toTokenInputValue={toTokenInputValue}
        setSizeDisplayMode={setSizeDisplayMode}
      />
    </TestProviders>
  );
}

function SliderHookInner({
  sizeDisplayMode,
  canConvert,
  tokensToUsd,
  setSizeInputValue,
  setToTokenInputValue,
  sizeInputValue,
  toTokenInputValue,
  setSizeDisplayMode,
}: {
  sizeDisplayMode: "usd" | "token";
  canConvert: boolean;
  tokensToUsd: (v: string) => string;
  setSizeInputValue: (v: string) => void;
  setToTokenInputValue: (v: string, r: boolean) => void;
  sizeInputValue: string;
  toTokenInputValue: string;
  setSizeDisplayMode: (mode: "usd" | "token") => void;
}) {
  const { isLeverageSliderEnabled, sizePercentage, handleSizePercentageChange, markFieldInteraction } =
    useTradeboxManualLeverageSizeSlider({
      sizeDisplayMode,
      canConvert,
      tokensToUsd,
      setSizeInputValue,
      setToTokenInputValue,
    });

  return (
    <div>
      <div data-testid="is-leverage-slider-enabled">{String(isLeverageSliderEnabled)}</div>
      <div data-testid="size-percentage">{sizePercentage}</div>
      <div data-testid="size-input-value">{sizeInputValue}</div>
      <div data-testid="to-token-input-value">{toTokenInputValue}</div>
      <div data-testid="size-display-mode">{sizeDisplayMode}</div>
      <div data-testid="can-convert">{String(canConvert)}</div>

      <button data-testid="change-50" onClick={() => handleSizePercentageChange(50)}>
        Set 50%
      </button>
      <button data-testid="change-100" onClick={() => handleSizePercentageChange(100)}>
        Set 100%
      </button>
      <button data-testid="change-0" onClick={() => handleSizePercentageChange(0)}>
        Set 0%
      </button>
      <button data-testid="mark-field" onClick={markFieldInteraction}>
        Mark Field Interaction
      </button>
      <button
        data-testid="toggle-display-mode"
        onClick={() => setSizeDisplayMode(sizeDisplayMode === "usd" ? "token" : "usd")}
      >
        Toggle Display Mode
      </button>
    </div>
  );
}
