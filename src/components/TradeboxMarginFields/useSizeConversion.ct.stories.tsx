import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
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

import { useSizeConversion } from "./useSizeConversion";

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

function createMockState(): SyntheticsState {
  const TOKENS_DATA = {
    [USDC_ADDRESS]: USDC_TOKEN,
    [ETH_ADDRESS]: ETH_TOKEN,
  };

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

// ─── Story Components ──────────────────────────

export type SizeConversionStoryProps = {
  tokenDecimals?: number;
  markPriceStr?: string; // "none" for undefined, "0" for 0n, or numeric string for expandDecimals
  hasToken?: boolean;
  visualMultiplier?: number;
  tokensInput?: string;
  usdInput?: string;
};

function parseMarkPrice(markPriceStr: string | undefined): bigint | undefined {
  if (markPriceStr === "none") return undefined;
  if (markPriceStr === "0") return 0n;
  if (markPriceStr === undefined) return expandDecimals(2000, 30);
  // Parse as a raw expandDecimals value
  return expandDecimals(Number(markPriceStr), 30);
}

/**
 * Renders the hook outputs as visible text for Playwright to assert on.
 * Uses data- attributes for easy querying.
 */
export function SizeConversionStory({
  tokenDecimals = 18,
  markPriceStr,
  hasToken = true,
  visualMultiplier,
  tokensInput = "1.5",
  usdInput = "3000",
}: SizeConversionStoryProps) {
  const state = useMemo(() => createMockState(), []);
  const markPrice = parseMarkPrice(markPriceStr);

  const toToken = hasToken
    ? ({
        ...ETH_TOKEN,
        decimals: tokenDecimals,
        visualMultiplier,
      } as TokenData)
    : undefined;

  const { canConvert, tokensToUsd, usdToTokens } = useSizeConversion({
    toToken,
    markPrice,
  });

  const tokensToUsdResult = tokensToUsd(tokensInput);
  const usdToTokensResult = usdToTokens(usdInput);

  return (
    <TestProviders state={state}>
      <div>
        <div data-testid="can-convert">{String(canConvert)}</div>
        <div data-testid="tokens-to-usd">{tokensToUsdResult}</div>
        <div data-testid="usd-to-tokens">{usdToTokensResult}</div>
      </div>
    </TestProviders>
  );
}

/**
 * Variant that allows dynamic input changes via input fields.
 */
export function SizeConversionDynamicStory({
  tokenDecimals = 18,
  markPrice = expandDecimals(2000, 30),
  visualMultiplier,
}: {
  tokenDecimals?: number;
  markPrice?: bigint;
  visualMultiplier?: number;
}) {
  const state = useMemo(() => createMockState(), []);
  const [tokensInput, setTokensInput] = useState("1.5");
  const [usdInput, setUsdInput] = useState("3000");

  const toToken = {
    ...ETH_TOKEN,
    decimals: tokenDecimals,
    visualMultiplier,
  } as TokenData;

  const { canConvert, tokensToUsd, usdToTokens } = useSizeConversion({
    toToken,
    markPrice,
  });

  const tokensToUsdResult = tokensToUsd(tokensInput);
  const usdToTokensResult = usdToTokens(usdInput);

  return (
    <TestProviders state={state}>
      <div>
        <div data-testid="can-convert">{String(canConvert)}</div>
        <div data-testid="tokens-to-usd">{tokensToUsdResult}</div>
        <div data-testid="usd-to-tokens">{usdToTokensResult}</div>
        <input data-testid="tokens-input" value={tokensInput} onChange={(e) => setTokensInput(e.target.value)} />
        <input data-testid="usd-input" value={usdInput} onChange={(e) => setUsdInput(e.target.value)} />
      </div>
    </TestProviders>
  );
}

/**
 * Memoization test: uses a single hook instance, re-renders via counter,
 * and checks that references are stable across re-renders via useRef.
 */
export function SizeConversionMemoStory() {
  const state = useMemo(() => createMockState(), []);
  const [renderCount, setRenderCount] = useState(0);

  const toToken = ETH_TOKEN;
  const markPrice = expandDecimals(2000, 30);

  const { tokensToUsd, usdToTokens, canConvert } = useSizeConversion({ toToken, markPrice });

  const prevTokensToUsdRef = useRef(tokensToUsd);
  const prevUsdToTokensRef = useRef(usdToTokens);

  const isStable = prevTokensToUsdRef.current === tokensToUsd && prevUsdToTokensRef.current === usdToTokens;

  // Update refs after checking
  useEffect(() => {
    prevTokensToUsdRef.current = tokensToUsd;
    prevUsdToTokensRef.current = usdToTokens;
  });

  return (
    <TestProviders state={state}>
      <div>
        <div data-testid="is-stable">{String(isStable)}</div>
        <div data-testid="can-convert">{String(canConvert)}</div>
        <div data-testid="render-count">{renderCount}</div>
        <button data-testid="rerender-btn" onClick={() => setRenderCount((c) => c + 1)}>
          Re-render
        </button>
      </div>
    </TestProviders>
  );
}
