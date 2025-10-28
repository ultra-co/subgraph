import {
  ProbabilityOracle,
  ProbabilityOracle_MarketSourceInitialized,
  ProbabilityOracle_PriceUpdated,
  ProbabilityOracle_PriceUpdaterChanged,
  ProbabilityOracle_TWAPPeriodUpdated,
} from "generated";

ProbabilityOracle.MarketSourceInitialized.handler(
  async ({ event, context }) => {
    const entity: ProbabilityOracle_MarketSourceInitialized = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      marketId: event.params.marketId,
      sourcePlatform: event.params.sourcePlatform,
      sourceMarketId: event.params.sourceMarketId,
    };

    context.ProbabilityOracle_MarketSourceInitialized.set(entity);
  }
);

ProbabilityOracle.PriceUpdated.handler(async ({ event, context }) => {
  const entity: ProbabilityOracle_PriceUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    price: event.params.price,
    timestamp: event.params.timestamp,
  };

  context.ProbabilityOracle_PriceUpdated.set(entity);
});

ProbabilityOracle.PriceUpdaterChanged.handler(async ({ event, context }) => {
  const entity: ProbabilityOracle_PriceUpdaterChanged = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    newUpdater: event.params.newUpdater,
  };

  context.ProbabilityOracle_PriceUpdaterChanged.set(entity);
});

ProbabilityOracle.TWAPPeriodUpdated.handler(async ({ event, context }) => {
  const entity: ProbabilityOracle_TWAPPeriodUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    newPeriod: event.params.newPeriod,
  };

  context.ProbabilityOracle_TWAPPeriodUpdated.set(entity);
});
