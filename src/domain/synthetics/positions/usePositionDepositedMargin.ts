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
  let earliestTimestamp: bigint | undefined;
  let sortedPositionKeys: string | undefined;

  if (positions && positions.length > 0) {
    let earliest = BigInt(Number.MAX_SAFE_INTEGER);
    const keys: string[] = [];

    for (const p of positions) {
      keys.push(p.key);
      if (p.increasedAtTime < earliest) {
        earliest = p.increasedAtTime;
      }
    }

    keys.sort();
    sortedPositionKeys = keys.join(",");
    earliestTimestamp = earliest;
  }

  const key =
    account && sortedPositionKeys && earliestTimestamp !== undefined
      ? ["usePositionDepositedMargin", chainId, account, sortedPositionKeys, earliestTimestamp.toString()]
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

    // Primary lookup: market:isLong:collateral (exact match)
    const positionByCollateralKey = new Map<string, PositionInfo>();
    // Fallback lookup: market:isLong (for swapped-collateral actions)
    const positionsByMarketDirection = new Map<string, PositionInfo[]>();

    for (const pos of positions) {
      const collateralKey = `${pos.marketAddress.toLowerCase()}:${pos.isLong}:${pos.collateralTokenAddress.toLowerCase()}`;
      positionByCollateralKey.set(collateralKey, pos);

      const mdKey = `${pos.marketAddress.toLowerCase()}:${pos.isLong}`;
      const list = positionsByMarketDirection.get(mdKey);
      if (list) {
        list.push(pos);
      } else {
        positionsByMarketDirection.set(mdKey, [pos]);
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
      /** True when any increase used a different initial collateral than the position's collateral (swap happened) */
      hasCollateralSwap: boolean;
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
      hasCollateralSwap: false,
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

      let matchedPosition = positionByCollateralKey.get(primaryKey);
      let isSwapped = false;

      if (!matchedPosition) {
        // initialCollateralToken differs from position collateral — likely a swap happened.
        // Fall back to market:isLong match if there's exactly one position.
        const mdKey = `${marketLower}:${action.isLong}`;
        const candidates = positionsByMarketDirection.get(mdKey);
        if (candidates?.length === 1) {
          matchedPosition = candidates[0];
          isSwapped = true;
        }
      }

      if (!matchedPosition) continue;

      const posKey = matchedPosition.key;

      if (!accumulators.has(posKey)) {
        accumulators.set(posKey, createEmptyAccumulator());
      }

      const acc = accumulators.get(posKey)!;
      const sizeDelta = BigInt(action.sizeDeltaUsd);

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

      if (isSwapped) {
        acc.hasCollateralSwap = true;
      }

      const normalizedAddress = getAddress(action.initialCollateralTokenAddress);
      const collateralDecimals = getByKey(tokensData, normalizedAddress)?.decimals;
      if (collateralDecimals === undefined) continue;

      const collateralPrice = action.collateralTokenPriceMin
        ? parseContractPrice(BigInt(action.collateralTokenPriceMin), collateralDecimals)
        : undefined;

      if (collateralPrice === undefined || collateralPrice === 0n) continue;

      const depositAmount = BigInt(action.initialCollateralDeltaAmount);
      acc.totalDepositedAmount += depositAmount;
      const depositUsd = convertToUsd(depositAmount, collateralDecimals, collateralPrice);
      if (depositUsd !== undefined) {
        acc.totalDepositedMarginUsd += depositUsd;
      }

      if (action.positionFeeAmount) {
        const feeAmount = BigInt(action.positionFeeAmount);
        acc.totalFeeAmount += feeAmount;
        const feeUsd = convertToUsd(feeAmount, collateralDecimals, collateralPrice);
        if (feeUsd !== undefined) {
          acc.totalOpenFeesUsd += feeUsd;
        }
      }
    }

    const result: PositionDepositedMarginMap = {};

    for (const pos of positions) {
      const acc = accumulators.get(pos.key);

      if (!acc) {
        // eslint-disable-next-line no-console
        console.debug(`[DepositedMargin] ${pos.key}: no matching actions found`);
        continue;
      }

      if (acc.hasPartialDecrease) {
        // eslint-disable-next-line no-console
        console.debug(`[DepositedMargin] ${pos.key}: has partial decrease`);
        continue;
      }

      if (queryTruncated && !acc.hadFullReset) {
        // eslint-disable-next-line no-console
        console.debug(`[DepositedMargin] ${pos.key}: query truncated without full reset`);
        continue;
      }

      if (acc.totalDepositedMarginUsd <= 0n) {
        // eslint-disable-next-line no-console
        console.debug(`[DepositedMargin] ${pos.key}: totalDepositedMarginUsd <= 0`);
        continue;
      }

      // When collateral was swapped, token amounts are in different denominations,
      // so the token-amount tolerance check is not applicable — rely on USD values only.
      if (!acc.hasCollateralSwap) {
        const computedCollateralAmount = acc.totalDepositedAmount - acc.totalFeeAmount;

        if (computedCollateralAmount <= 0n) {
          // eslint-disable-next-line no-console
          console.debug(`[DepositedMargin] ${pos.key}: computedCollateralAmount <= 0`);
          continue;
        }

        const onChainAmount = pos.collateralAmount;
        let isWithinTolerance = false;
        if (onChainAmount > 0n) {
          const diff =
            computedCollateralAmount > onChainAmount
              ? computedCollateralAmount - onChainAmount
              : onChainAmount - computedCollateralAmount;
          const tolerance = onChainAmount / 20n; // 5%
          isWithinTolerance = diff <= tolerance;
        }

        if (!isWithinTolerance) {
          // eslint-disable-next-line no-console
          console.debug(
            `[DepositedMargin] ${pos.key}: failed 5% tolerance check (computed=${computedCollateralAmount}, onChain=${onChainAmount})`
          );
          continue;
        }
      }

      result[pos.key] = {
        totalDepositedMarginUsd: acc.totalDepositedMarginUsd,
        totalOpenFeesUsd: acc.totalOpenFeesUsd,
        isReliable: true,
      };
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }, [rawActions, positions, tokensData]);

  return {
    depositedMarginMap,
    isLoading,
  };
}
