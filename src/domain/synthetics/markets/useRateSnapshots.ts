import useSWR from "swr";

import { useGmxSdk } from "context/GmxSdkContext/GmxSdkContext";
import { selectChainId } from "context/SyntheticsStateContext/selectors/globalSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { ApiParameterPeriod, MarketRates, RatesSnapshot } from "sdk/utils/rates/types";

export type RateTimeframe = "1d" | "7d" | "30d";

const TIMEFRAME_TO_PERIOD: Record<RateTimeframe, ApiParameterPeriod> = {
  "1d": "1d",
  "7d": "7d",
  "30d": "30d",
};

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function useRateSnapshots({
  marketAddress,
  timeframe,
}: {
  marketAddress: string | undefined;
  timeframe: RateTimeframe;
}) {
  const chainId = useSelector(selectChainId);
  const sdk = useGmxSdk(chainId);

  const { data, isLoading, error } = useSWR<RatesSnapshot[] | undefined>(
    sdk && marketAddress ? ["useRateSnapshots", chainId, marketAddress, timeframe] : null,
    {
      fetcher: async () => {
        const result: MarketRates[] = await sdk!.fetchRates({
          period: TIMEFRAME_TO_PERIOD[timeframe],
          address: marketAddress,
        });

        const marketData = result.find((r) => r.marketAddress.toLowerCase() === marketAddress!.toLowerCase());

        if (!marketData) {
          return [];
        }

        return [...marketData.ratesSnapshots].reverse();
      },
      refreshInterval: REFRESH_INTERVAL,
    }
  );

  const isWaitingForDeps = !sdk || !marketAddress;

  return {
    snapshots: data,
    isLoading: isLoading || (isWaitingForDeps && !data),
    error,
  };
}
