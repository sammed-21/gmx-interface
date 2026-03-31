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

import { MarginPercentageSlider } from "./MarginPercentageSlider";
import { PriceField } from "./PriceField";

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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: { [arbitrum.id]: http() },
});

function createMockState(): SyntheticsState {
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
      tradeType: TradeType.Long,
      tradeMode: TradeMode.Market,
      fromTokenAddress: USDC_ADDRESS,
      toTokenAddress: ETH_ADDRESS,
      marketAddress: undefined,
      marketInfo: undefined,
      collateralAddress: USDC_ADDRESS,
      collateralToken: USDC_TOKEN,
      focusedInput: "from",
      fromTokenInputValue: "1000",
      toTokenInputValue: "0.5",
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
      isLeverageSliderEnabled: true,
    },
  };

  return state as SyntheticsState;
}

function TestProviders({ children }: { children: ReactNode }) {
  const state = useMemo(() => createMockState(), []);
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

export type SliderStoryProps = {
  initialValue?: number;
  className?: string;
};

export function SliderStory({ initialValue = 50, className }: SliderStoryProps) {
  const [value, setValue] = useState(initialValue);
  const [lastOnChangeValue, setLastOnChangeValue] = useState<number | null>(null);

  const handleChange = useCallback((newValue: number) => {
    setValue(newValue);
    setLastOnChangeValue(newValue);
  }, []);

  return (
    <TestProviders>
      <div>
        <div data-testid="slider-value">{value}</div>
        <div data-testid="last-onchange">{lastOnChangeValue !== null ? String(lastOnChangeValue) : "none"}</div>
        <MarginPercentageSlider value={value} onChange={handleChange} className={className} />
      </div>
    </TestProviders>
  );
}

export function SliderClampStory({ value }: { value: number }) {
  const [onChangeValue, setOnChangeValue] = useState<string>("none");

  return (
    <TestProviders>
      <div>
        <div data-testid="onchange-value">{onChangeValue}</div>
        <MarginPercentageSlider value={value} onChange={(v) => setOnChangeValue(String(v))} />
      </div>
    </TestProviders>
  );
}

export type PriceFieldStoryProps = {
  tradeMode?: TradeMode;
  initialPrice?: string;
  markPrice?: bigint;
  hasMarkPriceClick?: boolean;
  visualMultiplier?: number;
};

export function PriceFieldStory({
  tradeMode = TradeMode.Limit,
  initialPrice = "2000",
  markPrice = expandDecimals(2000, 30),
  hasMarkPriceClick = true,
  visualMultiplier,
}: PriceFieldStoryProps) {
  const [price, setPrice] = useState(initialPrice);

  const indexToken = {
    ...ETH_TOKEN,
    visualMultiplier,
  } as TokenData;

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPrice(e.target.value);
  }, []);

  const onMarkPriceClick = hasMarkPriceClick ? () => setPrice("2000") : undefined;

  return (
    <TestProviders>
      <PriceField
        indexToken={indexToken}
        markPrice={markPrice}
        inputValue={price}
        onInputValueChange={handleChange}
        onMarkPriceClick={onMarkPriceClick}
        tradeMode={tradeMode}
        qa="trigger-price"
      />
    </TestProviders>
  );
}
