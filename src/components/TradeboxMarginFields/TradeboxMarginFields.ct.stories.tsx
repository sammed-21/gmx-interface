import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChangeEvent, ReactNode, useCallback, useMemo, useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { createConfig, http, WagmiProvider } from "wagmi";
import { arbitrum } from "wagmi/chains";

import { ARBITRUM } from "config/chains";
import type { SyntheticsState } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { StateCtx } from "context/SyntheticsStateContext/utils";
import { expandDecimals } from "lib/numbers";
import type { DeepPartial } from "lib/types";
import type { TokenData } from "sdk/utils/tokens/types";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

import { TradeboxMarginFields } from "./TradeboxMarginFields";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

// ─── Mock Tokens ──────────────────────────────

const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const ETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

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

// ─── Mock State Factory ───────────────────────

type MockStateOverrides = {
  tradeMode?: TradeMode;
  tradeType?: TradeType;
  fromTokenInputValue?: string;
  toTokenInputValue?: string;
  focusedInput?: "from" | "to";
  triggerPriceInputValue?: string;
  isLeverageSliderEnabled?: boolean;
};

function createMockState(overrides: MockStateOverrides = {}): SyntheticsState {
  const {
    tradeMode = TradeMode.Market,
    tradeType = TradeType.Long,
    fromTokenInputValue = "1000",
    toTokenInputValue = "0.5",
    focusedInput = "from",
    triggerPriceInputValue = "",
    isLeverageSliderEnabled = true,
  } = overrides;

  const state: DeepPartial<SyntheticsState> = {
    pageType: "trade",
    globals: {
      chainId: ARBITRUM,
      srcChainId: undefined,
      tokensDataResult: { tokensData: TOKENS_DATA },
      marketsInfo: { marketsInfoData: {} },
      positionsInfo: { positionsInfoData: {} },
      ordersInfo: { ordersInfoData: {} },
      uiFeeFactor: 0n,
      jitLiquidityData: {},
      gasLimits: undefined,
      gasPrice: undefined,
      userReferralInfo: undefined,
      depositMarketTokensData: undefined,
      blockTimestampData: undefined,
      oracleSettings: undefined,
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
      marketAddress: undefined,
      marketInfo: undefined,
      collateralAddress: USDC_ADDRESS,
      collateralToken: USDC_TOKEN,
      focusedInput,
      fromTokenInputValue,
      toTokenInputValue,
      triggerPriceInputValue,
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

// ─── Providers ────────────────────────────────

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

// ─── Story Component ──────────────────────────

export type StoryProps = {
  tradeMode?: TradeMode;
  tradeType?: TradeType;
  isLeverageSliderEnabled?: boolean;
  initialFromValue?: string;
  initialToValue?: string;
  initialTriggerPrice?: string;
  maxAvailableAmount?: bigint;
};

export function TradeboxMarginFieldsStory({
  tradeMode = TradeMode.Market,
  tradeType = TradeType.Long,
  isLeverageSliderEnabled = true,
  initialFromValue = "1000",
  initialToValue = "0.5",
  initialTriggerPrice,
  maxAvailableAmount = expandDecimals(10000, 6),
}: StoryProps) {
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

  const isLimit = tradeMode === TradeMode.Limit;

  const handleTriggerPriceChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTriggerPrice(e.target.value);
  }, []);

  return (
    <TestProviders state={state}>
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
