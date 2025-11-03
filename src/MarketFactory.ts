import { MarketFactory, MarketFactory_MarketCreated, Market } from "generated";
import { getMarketMetadata } from "./effects/getMarketMetadata";

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

  // Fetch market metadata (image) from Polymarket API if applicable
  const image = await context.effect(getMarketMetadata, {
    sourceMarketId: event.params.sourceMarketId,
    sourcePlatform: event.params.sourcePlatform,
  });

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
    question: undefined,
    image: image,
    currentPrice: BigInt(0),
    indexPrice: undefined,
    lastPriceUpdate: BigInt(event.block.timestamp),
  } as Market;

  context.Market.set(market);
});
