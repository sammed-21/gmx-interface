import { gql } from "@apollo/client";
import { useMemo } from "react";
import useSWR from "swr";
import { getAddress } from "viem";

import { isDecreaseOrderType, isIncreaseOrderType } from "domain/synthetics/orders";
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
  query PositionIncreaseDecreaseActions($account: String!) {
    tradeActions(
      limit: 1000
      orderBy: timestamp_DESC
      where: { account_eq: $account, eventName_eq: "OrderExecuted", orderType_in: [2, 3, 4, 5, 6, 7, 8] }
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
 * against on-chain collateralUsd with 5% tolerance.
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
  const positionKeys = useMemo(() => {
    if (!positions || positions.length === 0) return undefined;
    return positions.map((p) => p.key).sort();
  }, [positions]);

  const key =
    account && positionKeys && positionKeys.length > 0
      ? ["usePositionDepositedMargin", chainId, account, positionKeys.join(",")]
      : null;

  const { data: rawActions, isLoading } = useSWR(key, {
    fetcher: async () => {
      const client = getSubsquidGraphClient(chainId);
      if (!client) return undefined;

      const result = await client.query<{
        tradeActions: RawTradeActionRow[];
      }>({
        query: POSITION_ACTIONS_QUERY,
        variables: { account },
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

    const positionMap = new Map<string, PositionInfo>();
    for (const pos of positions) {
      const matchKey = `${pos.marketAddress.toLowerCase()}:${pos.isLong}:${pos.collateralTokenAddress.toLowerCase()}`;
      positionMap.set(matchKey, pos);
    }

    type Accumulator = {
      totalDepositedMarginUsd: bigint;
      totalOpenFeesUsd: bigint;
      hasPartialDecrease: boolean;
      runningSize: bigint;
      hadFullReset: boolean;
      hasSeenIncrease: boolean;
    };

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
      const isLiquidation = orderType === 7; // OrderType.Liquidation

      if (!isIncrease && !isDecrease && !isLiquidation) continue;

      const collateralAddress = action.initialCollateralTokenAddress.toLowerCase();
      const matchKey = `${action.marketAddress.toLowerCase()}:${action.isLong}:${collateralAddress}`;

      const matchedPosition = positionMap.get(matchKey);
      if (!matchedPosition) continue;

      const posKey = matchedPosition.key;

      if (!accumulators.has(posKey)) {
        accumulators.set(posKey, {
          totalDepositedMarginUsd: 0n,
          totalOpenFeesUsd: 0n,
          hasPartialDecrease: false,
          runningSize: 0n,
          hadFullReset: false,
          hasSeenIncrease: false,
        });
      }

      const acc = accumulators.get(posKey)!;
      const sizeDelta = BigInt(action.sizeDeltaUsd);

      if (isLiquidation) {
        acc.totalDepositedMarginUsd = 0n;
        acc.totalOpenFeesUsd = 0n;
        acc.hasPartialDecrease = false;
        acc.runningSize = 0n;
        acc.hadFullReset = true;
        acc.hasSeenIncrease = false;
        continue;
      }

      if (isDecrease) {
        acc.runningSize -= sizeDelta;

        if (acc.runningSize <= 0n && acc.hasSeenIncrease) {
          // Full close — reset for potential reopen (skip if no prior increase seen, may be truncated)
          acc.totalDepositedMarginUsd = 0n;
          acc.totalOpenFeesUsd = 0n;
          acc.hasPartialDecrease = false;
          acc.runningSize = 0n;
          acc.hadFullReset = true;
          acc.hasSeenIncrease = false;
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
      const depositUsd = convertToUsd(depositAmount, collateralDecimals, collateralPrice);
      if (depositUsd !== undefined) {
        acc.totalDepositedMarginUsd += depositUsd;
      }

      if (action.positionFeeAmount) {
        const feeAmount = BigInt(action.positionFeeAmount);
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

      const computedInitialCollateral = acc.totalDepositedMarginUsd - acc.totalOpenFeesUsd;
      if (acc.totalDepositedMarginUsd <= 0n || computedInitialCollateral <= 0n) continue;

      // Validate against on-chain collateralUsd (5% tolerance for price drift)
      const onChainCollateral = pos.collateralUsd;
      let isReliable = false;

      if (onChainCollateral > 0n) {
        const diff =
          computedInitialCollateral > onChainCollateral
            ? computedInitialCollateral - onChainCollateral
            : onChainCollateral - computedInitialCollateral;
        const tolerance = onChainCollateral / 20n; // 5%
        isReliable = diff <= tolerance;
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
  }, [rawActions, positions, tokensData]);

  return {
    depositedMarginMap,
    isLoading,
  };
}
