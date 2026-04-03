import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { ChangeEvent, ReactNode, useCallback, useMemo, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";

import type { SyntheticsState } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { StateCtx } from "context/SyntheticsStateContext/utils";
import { expandDecimals, PRECISION } from "lib/numbers";
import type { MarketInfo } from "sdk/utils/markets/types";
import type { TokenData } from "sdk/utils/tokens/types";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { TradeboxMarginFields } from "../TradeboxMarginFields";
import {
  noop,
  USDC_ADDRESS,
  ETH_ADDRESS,
  USDC_TOKEN,
  ETH_TOKEN,
  createMockState,
  queryClient,
  wagmiConfig,
} from "./testFixtures";

const BTC_ADDRESS = "0x47904963fc8b2340414262125aF798B9655E58Cd";

const BTC_TOKEN = {
  name: "Bitcoin",
  symbol: "BTC",
  decimals: 8,
  address: BTC_ADDRESS,
  prices: {
    minPrice: expandDecimals(60000, 30),
    maxPrice: expandDecimals(60000, 30),
  },
  balance: expandDecimals(1, 8),
} as TokenData;

const MARKET_ADDRESS = "0x70d95587d40A2caf56bd97485aB3Eec10Bee6336";

function createMockMarketInfo(ethToken: TokenData = ETH_TOKEN): MarketInfo {
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
    longToken: ethToken,
    shortToken: USDC_TOKEN,
    indexToken: ethToken,
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
    longInterestUsd: 0n,
    shortInterestUsd: 0n,
    longInterestInTokens: 0n,
    shortInterestInTokens: 0n,
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

function useDynamicTokensData(ethPrice: number) {
  const dynamicEthToken = useMemo(
    () =>
      ({
        ...ETH_TOKEN,
        prices: {
          minPrice: expandDecimals(ethPrice, 30),
          maxPrice: expandDecimals(ethPrice, 30),
        },
      }) as TokenData,
    [ethPrice]
  );

  const tokensData = useMemo(
    () => ({
      [USDC_ADDRESS]: USDC_TOKEN,
      [ETH_ADDRESS]: dynamicEthToken,
      [BTC_ADDRESS]: BTC_TOKEN,
    }),
    [dynamicEthToken]
  );

  return { dynamicEthToken, tokensData };
}

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

export type IntegrationStoryProps = {
  tradeMode?: TradeMode;
  tradeType?: TradeType;
  isLeverageSliderEnabled?: boolean;
  initialFromValue?: string;
  initialToValue?: string;
  initialTriggerPrice?: string;
  maxAvailableAmount?: bigint;
};

/**
 * Integration story that exposes internal state for testing.
 * Renders data attributes for focusedInput, toTokenInputValue, etc.
 */
export function IntegrationStory({
  tradeMode = TradeMode.Market,
  tradeType = TradeType.Long,
  isLeverageSliderEnabled = true,
  initialFromValue = "1000",
  initialToValue = "0.5",
  initialTriggerPrice,
  maxAvailableAmount = expandDecimals(10000, 6),
}: IntegrationStoryProps) {
  const [fromValue, setFromValue] = useState(initialFromValue);
  const [toValue, setToValue] = useState(initialToValue);
  const [focused, setFocused] = useState<"from" | "to">("from");
  const [triggerPrice, setTriggerPrice] = useState(initialTriggerPrice ?? "");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const state = useMemo(
    () =>
      createMockState({
        tradeMode,
        tradeType,
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        triggerPriceInputValue: triggerPrice,
        isLeverageSliderEnabled,
      }),
    [tradeMode, tradeType, fromValue, toValue, focused, triggerPrice, isLeverageSliderEnabled]
  );

  const isLimit = tradeMode === TradeMode.Limit || tradeMode === TradeMode.StopMarket;

  const handleTriggerPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTriggerPrice(e.target.value);
  }, []);

  return (
    <TestProviders state={state}>
      {/* Debug output for test assertions */}
      <div data-testid="debug-state" className="hidden">
        <span data-testid="focused-input">{focused}</span>
        <span data-testid="from-value">{fromValue}</span>
        <span data-testid="to-value">{toValue}</span>
        <span data-testid="trigger-price">{triggerPrice}</span>
      </div>

      <TradeboxMarginFields
        maxAvailableAmount={maxAvailableAmount}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
        triggerPriceInputValue={isLimit ? triggerPrice : undefined}
        onTriggerPriceInputChange={isLimit ? handleTriggerPriceChange : undefined}
        onMarkPriceClick={isLimit ? () => setTriggerPrice("2000") : undefined}
      />
    </TestProviders>
  );
}

export type PriceChangeStoryProps = {
  initialFromValue?: string;
  initialToValue?: string;
  ethPrice?: number;
  isLeverageSliderEnabled?: boolean;
  maxAvailableAmount?: bigint;
};

/**
 * Story with dynamic ETH price for testing field recalculation on price changes.
 * Uses ethPrice prop controlled via component.update() in tests.
 */
export function PriceChangeStory({
  initialFromValue = "1000",
  initialToValue = "1",
  ethPrice = 2000,
  isLeverageSliderEnabled = true,
  maxAvailableAmount = expandDecimals(10000, 6),
}: PriceChangeStoryProps) {
  const [fromValue, setFromValue] = useState(initialFromValue);
  const [toValue, setToValue] = useState(initialToValue);
  const [focused, setFocused] = useState<"from" | "to">("from");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const { tokensData } = useDynamicTokensData(ethPrice);

  const state = useMemo(
    () =>
      createMockState({
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        isLeverageSliderEnabled,
        tokensData,
      }),
    [fromValue, toValue, focused, isLeverageSliderEnabled, tokensData]
  );

  return (
    <TestProviders state={state}>
      <div data-testid="debug-state" className="hidden">
        <span data-testid="focused-input">{focused}</span>
        <span data-testid="from-value">{fromValue}</span>
        <span data-testid="to-value">{toValue}</span>
        <span data-testid="eth-price">{ethPrice}</span>
      </div>

      <TradeboxMarginFields
        maxAvailableAmount={maxAvailableAmount}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
      />
    </TestProviders>
  );
}

export type LeverageOffStoryProps = {
  initialFromValue?: string;
  initialToValue?: string;
  ethPrice?: number;
  maxAvailableAmount?: bigint;
};

/**
 * Story with isLeverageSliderEnabled=false and marketInfo provided,
 * so the slider drives size (not margin) and maxSizeByMarginInTokens is computed.
 */
export function LeverageOffStory({
  initialFromValue = "1000",
  initialToValue = "",
  ethPrice = 2000,
  maxAvailableAmount = expandDecimals(10000, 6),
}: LeverageOffStoryProps) {
  const [fromValue, setFromValue] = useState(initialFromValue);
  const [toValue, setToValue] = useState(initialToValue);
  const [focused, setFocused] = useState<"from" | "to">("from");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const { dynamicEthToken, tokensData } = useDynamicTokensData(ethPrice);
  const marketInfo = useMemo(() => createMockMarketInfo(dynamicEthToken), [dynamicEthToken]);

  const state = useMemo(
    () =>
      createMockState({
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        isLeverageSliderEnabled: false,
        tokensData,
        marketInfo,
      }),
    [fromValue, toValue, focused, tokensData, marketInfo]
  );

  return (
    <TestProviders state={state}>
      <div data-testid="debug-state" className="hidden">
        <span data-testid="focused-input">{focused}</span>
        <span data-testid="from-value">{fromValue}</span>
        <span data-testid="to-value">{toValue}</span>
        <span data-testid="eth-price">{ethPrice}</span>
      </div>

      <TradeboxMarginFields
        maxAvailableAmount={maxAvailableAmount}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
      />
    </TestProviders>
  );
}

export type EthMarginPriceChangeStoryProps = {
  initialFromValue?: string;
  initialToValue?: string;
  ethPrice?: number;
  maxAvailableAmount?: bigint;
};

/**
 * Story with ETH as pay token (margin ≠ collateral) and dynamic price.
 */
export function EthMarginPriceChangeStory({
  initialFromValue = "5",
  initialToValue = "1",
  ethPrice = 2000,
  maxAvailableAmount = expandDecimals(10, 18),
}: EthMarginPriceChangeStoryProps) {
  const [fromValue, setFromValue] = useState(initialFromValue);
  const [toValue, setToValue] = useState(initialToValue);
  const [focused, setFocused] = useState<"from" | "to">("from");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const { tokensData } = useDynamicTokensData(ethPrice);

  const state = useMemo(
    () =>
      createMockState({
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        tokensData,
        fromTokenAddress: ETH_ADDRESS,
      }),
    [fromValue, toValue, focused, tokensData]
  );

  return (
    <TestProviders state={state}>
      <div data-testid="debug-state" className="hidden">
        <span data-testid="focused-input">{focused}</span>
        <span data-testid="from-value">{fromValue}</span>
        <span data-testid="to-value">{toValue}</span>
        <span data-testid="eth-price">{ethPrice}</span>
      </div>

      <TradeboxMarginFields
        maxAvailableAmount={maxAvailableAmount}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
      />
    </TestProviders>
  );
}

/**
 * Story with no onTriggerPriceInputChange to test that PriceField is not rendered.
 */
export function IntegrationNoTriggerCallbackStory() {
  const [fromValue, setFromValue] = useState("1000");
  const [toValue, setToValue] = useState("0.5");
  const [focused, setFocused] = useState<"from" | "to">("from");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const state = useMemo(
    () =>
      createMockState({
        tradeMode: TradeMode.Limit,
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        triggerPriceInputValue: "2000",
      }),
    [fromValue, toValue, focused]
  );

  return (
    <TestProviders state={state}>
      <TradeboxMarginFields
        maxAvailableAmount={expandDecimals(10000, 6)}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
        triggerPriceInputValue={undefined}
        onTriggerPriceInputChange={undefined}
      />
    </TestProviders>
  );
}

/**
 * Story for maxAvailableAmount divergence test.
 * Balance is 10000 USDC but maxAvailableAmount is only 5000 USDC.
 */
export function MaxAvailableDivergenceStory() {
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [focused, setFocused] = useState<"from" | "to">("from");

  const setToValueWithReset = useCallback((value: string, _resetPriceImpact: boolean) => {
    setToValue(value);
  }, []);

  const state = useMemo(
    () =>
      createMockState({
        fromTokenInputValue: fromValue,
        toTokenInputValue: toValue,
        focusedInput: focused,
        isLeverageSliderEnabled: true,
      }),
    [fromValue, toValue, focused]
  );

  return (
    <TestProviders state={state}>
      <div data-testid="debug-state" className="hidden">
        <span data-testid="focused-input">{focused}</span>
        <span data-testid="from-value">{fromValue}</span>
        <span data-testid="to-value">{toValue}</span>
      </div>

      <TradeboxMarginFields
        maxAvailableAmount={expandDecimals(5000, 6)}
        onSelectFromTokenAddress={noop}
        onDepositTokenAddress={noop}
        fromTokenInputValue={fromValue}
        setFromTokenInputValue={(value) => setFromValue(value)}
        setFocusedInput={setFocused}
        toTokenInputValue={toValue}
        setToTokenInputValue={setToValueWithReset}
      />
    </TestProviders>
  );
}
