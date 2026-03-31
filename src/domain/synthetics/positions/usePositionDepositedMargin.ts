import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";
import { getAddress } from "viem";

import { isDecreaseOrderType, isIncreaseOrderType, OrderType } from "domain/synthetics/orders";
import { PositionInfo } from "domain/synthetics/positions/types";
import { convertToUsd, parseContractPrice, TokensData } from "domain/synthetics/tokens";
import { getSubsquidGraphClient } from "lib/indexers/clients";
import { getByKey } from "lib/objects";

export type PositionDepositedMarginData = {
  totalDepositedMarginUsd: bigint;
  totalOpenFeesUsd: bigint;
  isReliable: boolean;
};

export type PositionDepositedMarginMap = {
  [positionKey: string]: PositionDepositedMarginData;
};

type RawTradeActionRow = {
  orderType: number;
  eventName: string;
  marketAddress: string;
  isLong: boolean;
  initialCollateralTokenAddress: string;
  initialCollateralDeltaAmount: string;
  positionFeeAmount: string | null;
  collateralTokenPriceMin: string | null;
  sizeDeltaUsd: string;
  timestamp: number;
};

const POSITION_ACTIONS_QUERY = gql`
  query PositionIncreaseDecreaseActions($account: String!, $fromTimestamp: Int!) {
    tradeActions(
      limit: 1000
      orderBy: timestamp_DESC
      where: {
        account_eq: $account
        eventName_eq: "OrderExecuted"
        # 2=MarketIncrease, 3=LimitIncrease, 4=MarketDecrease, 5=LimitDecrease,
        # 6=StopLossDecrease, 7=Liquidation, 8=StopIncrease
        orderType_in: [2, 3, 4, 5, 6, 7, 8]
        timestamp_gte: $fromTimestamp
      }
    ) {
      orderType
      eventName
      marketAddress
      isLong
      initialCollateralTokenAddress
      initialCollateralDeltaAmount
      positionFeeAmount
      collateralTokenPriceMin
      sizeDeltaUsd
      timestamp
    }
  }
`;

/**
 * Aggregates deposited margin and open fees per position from indexed trade actions.
 * Tracks running size to detect full closes and resets accumulators on reopen.
 * Skips positions with partial decreases (inaccurate split) and validates
 * against on-chain collateralAmount with 5% token-amount tolerance.
 * Falls back to USD-based validation when swap-path actions mix token denominations.
 */
export function usePositionDepositedMargin(
  chainId: number,
  account: string | null | undefined,
  positions: PositionInfo[] | undefined,
  tokensData: TokensData | undefined
): {
  depositedMarginMap: PositionDepositedMarginMap | undefined;
  isLoading: boolean;
} {
  const { positionKeysString, earliestTimestamp } = useMemo(() => {
    if (!positions || positions.length === 0) return { positionKeysString: undefined, earliestTimestamp: undefined };

    let earliest = BigInt(Number.MAX_SAFE_INTEGER);
    const keys: string[] = [];

    for (const p of positions) {
      keys.push(p.key);
      if (p.increasedAtTime < earliest) {
        earliest = p.increasedAtTime;
      }
    }

    keys.sort();
    return { positionKeysString: keys.join(","), earliestTimestamp: earliest };
  }, [positions]);

  // Stable key derived from token addresses — decimals are immutable per token
  const tokenAddressesKey = useMemo(() => {
    if (!tokensData) return undefined;
    return Object.keys(tokensData).sort().join(",");
  }, [tokensData]);

  const key =
    account && positionKeysString && earliestTimestamp !== undefined
      ? ["usePositionDepositedMargin", chainId, account, positionKeysString, earliestTimestamp.toString()]
      : null;

  const { data: rawActions, isLoading } = useSWR(key, {
    fetcher: async () => {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return undefined;

      const result = await client.query<{
        tradeActions: RawTradeActionRow[];
      }>({
        query: POSITION_ACTIONS_QUERY,
        variables: { account, fromTimestamp: Number(earliestTimestamp) },
        fetchPolicy: "no-cache",
      });

      return result.data?.tradeActions;
    },
    refreshInterval: 60_000,
    errorRetryCount: 2,
  });

  const depositedMarginMap = useMemo(() => {
    if (!rawActions || !positions || positions.length === 0 || !tokensData) {
      return undefined;
    }

    // Primary lookup: marketAddress:isLong:collateralTokenAddress
    const positionMap = new Map<string, PositionInfo>();
    // Secondary lookup: marketAddress:isLong -> positions (fallback for swap-path actions)
    const positionsByMarketDirection = new Map<string, PositionInfo[]>();

    for (const pos of positions) {
      const collateralKey = `${pos.marketAddress.toLowerCase()}:${pos.isLong}:${pos.collateralTokenAddress.toLowerCase()}`;
      positionMap.set(collateralKey, pos);

      const directionKey = `${pos.marketAddress.toLowerCase()}:${pos.isLong}`;
      const existing = positionsByMarketDirection.get(directionKey);
      if (existing) {
        existing.push(pos);
      } else {
        positionsByMarketDirection.set(directionKey, [pos]);
      }
    }

    type Accumulator = {
      totalDepositedMarginUsd: bigint;
      totalOpenFeesUsd: bigint;
      totalDepositedAmount: bigint;
      totalFeeAmount: bigint;
      hasPartialDecrease: boolean;
      runningSize: bigint;
      hadFullReset: boolean;
      hasSeenIncrease: boolean;
      hasMismatchedCollateral: boolean;
    };

    const createEmptyAccumulator = (): Accumulator => ({
      totalDepositedMarginUsd: 0n,
      totalOpenFeesUsd: 0n,
      totalDepositedAmount: 0n,
      totalFeeAmount: 0n,
      hasPartialDecrease: false,
      runningSize: 0n,
      hadFullReset: false,
      hasSeenIncrease: false,
      hasMismatchedCollateral: false,
    });

    const accumulators = new Map<string, Accumulator>();
    const queryTruncated = rawActions.length >= 1000;

    // Query returns newest-first, process chronologically
    const chronologicalActions = [...rawActions].reverse();

    for (const action of chronologicalActions) {
      if (!action.marketAddress || action.isLong === null || action.isLong === undefined) {
        continue;
      }

      const orderType = Number(action.orderType);
      const isIncrease = isIncreaseOrderType(orderType);
      const isDecrease = isDecreaseOrderType(orderType);
      const isLiquidation = orderType === OrderType.Liquidation;

      if (!isIncrease && !isDecrease && !isLiquidation) continue;

      const marketLower = action.marketAddress.toLowerCase();
      const collateralLower = action.initialCollateralTokenAddress.toLowerCase();
      const primaryKey = `${marketLower}:${action.isLong}:${collateralLower}`;

      let matchedPosition = positionMap.get(primaryKey);

      // Fallback: when a swap path was used, initialCollateralTokenAddress differs from
      // the position's collateralTokenAddress. Match by market+direction if unambiguous.
      if (!matchedPosition) {
        const directionKey = `${marketLower}:${action.isLong}`;
        const candidates = positionsByMarketDirection.get(directionKey);
        if (candidates && candidates.length === 1) {
          matchedPosition = candidates[0];
        }
      }

      if (!matchedPosition) continue;

      const isCollateralMatched = collateralLower === matchedPosition.collateralTokenAddress.toLowerCase();
      const posKey = matchedPosition.key;

      if (!accumulators.has(posKey)) {
        accumulators.set(posKey, createEmptyAccumulator());
      }

      const acc = accumulators.get(posKey)!;
      const sizeDelta = BigInt(action.sizeDeltaUsd);

      if (!isCollateralMatched) {
        acc.hasMismatchedCollateral = true;
      }

      if (isLiquidation) {
        Object.assign(acc, createEmptyAccumulator());
        acc.hadFullReset = true;
        continue;
      }

      if (isDecrease) {
        acc.runningSize -= sizeDelta;

        if (acc.runningSize <= 0n && acc.hasSeenIncrease) {
          // Full close — reset for potential reopen (skip if no prior increase seen, may be truncated)
          Object.assign(acc, createEmptyAccumulator());
          acc.hadFullReset = true;
        } else {
          acc.hasPartialDecrease = true;
        }
        continue;
      }

      acc.runningSize += sizeDelta;
      acc.hasSeenIncrease = true;

      const normalizedAddress = getAddress(action.initialCollateralTokenAddress);
      const collateralDecimals = getByKey(tokensData, normalizedAddress)?.decimals;
      if (collateralDecimals === undefined) continue;

      const collateralPrice = action.collateralTokenPriceMin
        ? parseContractPrice(BigInt(action.collateralTokenPriceMin), collateralDecimals)
        : undefined;

      if (collateralPrice === undefined || collateralPrice === 0n) continue;

      const depositAmount = BigInt(action.initialCollateralDeltaAmount);
      if (isCollateralMatched) {
        acc.totalDepositedAmount += depositAmount;
      }
      const depositUsd = convertToUsd(depositAmount, collateralDecimals, collateralPrice);
      if (depositUsd !== undefined) {
        acc.totalDepositedMarginUsd += depositUsd;
      }

      if (action.positionFeeAmount) {
        const feeAmount = BigInt(action.positionFeeAmount);
        if (isCollateralMatched) {
          acc.totalFeeAmount += feeAmount;
        }
        const feeUsd = convertToUsd(feeAmount, collateralDecimals, collateralPrice);
        if (feeUsd !== undefined) {
          acc.totalOpenFeesUsd += feeUsd;
        }
      }
    }

    const result: PositionDepositedMarginMap = {};

    for (const pos of positions) {
      const acc = accumulators.get(pos.key);
      if (!acc) continue;

      if (acc.hasPartialDecrease) continue;

      // Truncated query without a full reset — may be missing earlier increases
      if (queryTruncated && !acc.hadFullReset) continue;

      // Swap-path matched positions without a full lifecycle reset are unreliable —
      // actions may belong to a prior closed position with different collateral
      if (acc.hasMismatchedCollateral && !acc.hadFullReset) continue;

      const computedInitialCollateral = acc.totalDepositedMarginUsd - acc.totalOpenFeesUsd;
      if (acc.totalDepositedMarginUsd <= 0n || computedInitialCollateral <= 0n) continue;

      let isReliable = false;

      if (acc.hasMismatchedCollateral) {
        // When collateral tokens were mixed, token-amount comparison is meaningless.
        // Fall back to USD-based comparison with 5% tolerance.
        const onChainCollateral = pos.collateralUsd;
        if (onChainCollateral > 0n) {
          const diff =
            computedInitialCollateral > onChainCollateral
              ? computedInitialCollateral - onChainCollateral
              : onChainCollateral - computedInitialCollateral;
          const tolerance = onChainCollateral / 20n; // 5%
          isReliable = diff <= tolerance;
        }
      } else {
        // Token-amount comparison is immune to price movements, unlike USD comparison.
        const computedCollateralAmount = acc.totalDepositedAmount - acc.totalFeeAmount;
        const onChainAmount = pos.collateralAmount;
        if (onChainAmount > 0n && computedCollateralAmount > 0n) {
          const diff =
            computedCollateralAmount > onChainAmount
              ? computedCollateralAmount - onChainAmount
              : onChainAmount - computedCollateralAmount;
          const tolerance = onChainAmount / 20n; // 5%
          isReliable = diff <= tolerance;
        }
      }

      if (isReliable) {
        result[pos.key] = {
          totalDepositedMarginUsd: acc.totalDepositedMarginUsd,
          totalOpenFeesUsd: acc.totalOpenFeesUsd,
          isReliable,
        };
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
    // positionKeysString and tokenAddressesKey provide stable change detection for positions and tokensData
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawActions, positionKeysString, tokenAddressesKey]);

  return {
    depositedMarginMap,
    isLoading,
  };
}
