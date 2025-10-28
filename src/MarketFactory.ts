import { MarketFactory, MarketFactory_MarketCreated, Market } from "generated";

MarketFactory.MarketCreated.handler(async ({ event, context }) => {
  // Create raw event entity for auditing
  const eventEntity: MarketFactory_MarketCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    name: event.params.name,
    sourcePlatform: event.params.sourcePlatform,
    sourceMarketId: event.params.sourceMarketId,
    expiryTimestamp: event.params.expiryTimestamp,
    creator: event.params.creator,
  };

  context.MarketFactory_MarketCreated.set(eventEntity);

  // Create business logic Market entity
  const market: Market = {
    id: `${event.chainId}_${event.params.marketId}`,
    marketId: event.params.marketId,
    name: event.params.name,
    sourcePlatform: event.params.sourcePlatform,
    sourceMarketId: event.params.sourceMarketId,
    expiryTimestamp: event.params.expiryTimestamp,
    creator: event.params.creator,
    createdAt: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.Market.set(market);
});
