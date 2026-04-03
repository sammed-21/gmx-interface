import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { arbitrum } from "wagmi/chains";

import { ARBITRUM } from "config/chains";
import type { SyntheticsState } from "context/SyntheticsStateContext/SyntheticsStateContextProvider";
import { expandDecimals } from "lib/numbers";
import type { DeepPartial } from "lib/types";
import type { TokenData } from "sdk/utils/tokens/types";
import { TradeMode, TradeType } from "sdk/utils/trade/types";

// eslint-disable-next-line @typescript-eslint/no-empty-function
export const noop = () => {};

export const USDC_ADDRESS = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
export const ETH_ADDRESS = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

export const USDC_TOKEN = {
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

export const ETH_TOKEN = {
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

export type MockStateOverrides = {
  tradeMode?: TradeMode;
  tradeType?: TradeType;
  fromTokenInputValue?: string;
  toTokenInputValue?: string;
  focusedInput?: "from" | "to";
  triggerPriceInputValue?: string;
  isLeverageSliderEnabled?: boolean;
  fromTokenAddress?: string;
  toTokenAddress?: string;
  marketAddress?: string;
  tokensData?: Record<string, TokenData>;
  marketInfo?: { marketTokenAddress: string; [key: string]: unknown };
};

export function createMockState(overrides: MockStateOverrides = {}): SyntheticsState {
  const {
    tradeMode = TradeMode.Market,
    tradeType = TradeType.Long,
    fromTokenInputValue = "1000",
    toTokenInputValue = "0.5",
    focusedInput = "from",
    triggerPriceInputValue = "",
    isLeverageSliderEnabled = true,
    fromTokenAddress = USDC_ADDRESS,
    toTokenAddress = ETH_ADDRESS,
    marketAddress,
    tokensData = { [USDC_ADDRESS]: USDC_TOKEN, [ETH_ADDRESS]: ETH_TOKEN },
    marketInfo,
  } = overrides;

  const state: DeepPartial<SyntheticsState> = {
    pageType: "trade",
    globals: {
      chainId: ARBITRUM,
      srcChainId: undefined,
      tokensDataResult: { tokensData },
      marketsInfo: {
        marketsInfoData: marketInfo ? { [marketInfo.marketTokenAddress]: marketInfo } : {},
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
      fromTokenAddress,
      toTokenAddress,
      marketAddress: marketInfo ? marketInfo.marketTokenAddress : marketAddress,
      marketInfo: marketInfo ?? undefined,
      collateralAddress: fromTokenAddress,
      collateralToken: tokensData[fromTokenAddress] ?? USDC_TOKEN,
      focusedInput,
      fromTokenInputValue,
      toTokenInputValue,
      triggerPriceInputValue,
      isFromTokenGmxAccount: false,
      leverageOption: 20000,
      availableTokensOptions: {
        swapTokens: Object.values(tokensData),
        infoTokens: tokensData,
        sortedLongAndShortTokens: [toTokenAddress],
      },
    },
    settings: {
      isLeverageSliderEnabled,
    },
  };

  return state as SyntheticsState;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

export const wagmiConfig = createConfig({
  chains: [arbitrum],
  transports: { [arbitrum.id]: http() },
});
