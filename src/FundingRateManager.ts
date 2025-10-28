import {
  FundingRateManager,
  FundingRateManager_FundingRateCalculated,
} from "generated";

FundingRateManager.FundingRateCalculated.handler(async ({ event, context }) => {
  const entity: FundingRateManager_FundingRateCalculated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    fundingRate: event.params.fundingRate,
    skew: event.params.skew,
    timestamp: event.params.timestamp,
  };

  context.FundingRateManager_FundingRateCalculated.set(entity);
});
