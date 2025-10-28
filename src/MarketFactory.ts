import { MarketFactory, MarketFactory_MarketCreated } from "generated";

MarketFactory.MarketCreated.handler(async ({ event, context }) => {
  const entity: MarketFactory_MarketCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    name: event.params.name,
    sourcePlatform: event.params.sourcePlatform,
    sourceMarketId: event.params.sourceMarketId,
    expiryTimestamp: event.params.expiryTimestamp,
    creator: event.params.creator,
  };

  context.MarketFactory_MarketCreated.set(entity);
});
