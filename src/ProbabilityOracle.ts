import {
  ProbabilityOracle,
  ProbabilityOracle_MarketSourceInitialized,
  ProbabilityOracle_PriceUpdated,
  ProbabilityOracle_PriceUpdaterChanged,
  ProbabilityOracle_TWAPPeriodUpdated,
  Market,
  PriceObservation,
  PriceCandle,
  Position,
  Trader,
  PositionPnLSnapshot,
  TraderPnLSnapshot,
} from "generated";
import { getIndexPrice } from "./effects/getPrice";
import { getMarketMetadata } from "./effects/getMarketMetadata";
import { MARKET_QUESTIONS } from "./constants/marketQuestions";
import {
  getPeriodStart,
  getPeriodDuration,
  calculatePositionPnl,
  calculatePnlPercentage,
} from "./utils/priceHelpers";

const CANDLE_INTERVALS = [
  "ONE_MINUTE",
  "FIVE_MINUTES",
  "FIFTEEN_MINUTES",
  "ONE_HOUR",
  "FOUR_HOURS",
  "TWELVE_HOURS",
  "ONE_DAY",
] as const;

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
  const eventEntity: ProbabilityOracle_PriceUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    price: event.params.price,
    timestamp: event.params.timestamp,
  };

  context.ProbabilityOracle_PriceUpdated.set(eventEntity);

  const marketFullId = `${event.chainId}_${event.params.marketId}`;
  let market = await context.Market.get(marketFullId);

  if (!market) {
    context.log.warn(`Market ${marketFullId} not found, skipping price update`);
    return;
  }

  const indexPriceResult = await context.effect(getIndexPrice, {
    marketId: event.params.marketId,
    blockNumber: event.block.number,
  });

  const indexPrice = indexPriceResult
    ? BigInt(indexPriceResult)
    : market.indexPrice || BigInt(0);

  // Check and update question if missing
  let question = market.question;
  if (!question || question.trim() === "") {
    const questionForMarket = MARKET_QUESTIONS[event.params.marketId];
    if (questionForMarket) {
      question = questionForMarket;
    }
  }

  // Check and update image if missing
  let image = market.image;
  if (
    (!image || image.trim() === "") &&
    market.sourcePlatform?.toLowerCase() === "polymarket" &&
    market.sourceMarketId
  ) {
    const imageUrl = await context.effect(getMarketMetadata, {
      sourceMarketId: market.sourceMarketId,
      sourcePlatform: market.sourcePlatform,
    });
    if (imageUrl) {
      image = imageUrl;
    }
  }

  const updatedMarket: Market = {
    ...market,
    question,
    image,
    currentPrice: event.params.price,
    indexPrice,
    lastPriceUpdate: event.params.timestamp,
  };

  context.Market.set(updatedMarket);

  const observation: PriceObservation = {
    id: `${event.chainId}_${event.params.marketId}_${event.params.timestamp}`,
    market_id: marketFullId,
    price: event.params.price,
    indexPrice: indexPrice,
    timestamp: event.params.timestamp,
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.PriceObservation.set(observation);

  for (const interval of CANDLE_INTERVALS) {
    await updateCandle(
      context,
      marketFullId,
      interval,
      event.params.timestamp,
      event.params.price,
      indexPrice
    );
  }
});

async function updateCandle(
  context: any,
  marketId: string,
  interval: string,
  timestamp: bigint,
  spotPrice: bigint,
  indexPrice: bigint | undefined
) {
  const periodStart = getPeriodStart(timestamp, interval);
  const periodEnd = periodStart + getPeriodDuration(interval);
  const candleId = `${marketId}_${interval}_${periodStart}`;

  let candle = await context.PriceCandle.get(candleId);

  if (!candle) {
    candle = {
      id: candleId,
      market_id: marketId,
      interval: interval,
      openPrice: spotPrice,
      highPrice: spotPrice,
      lowPrice: spotPrice,
      closePrice: spotPrice,
      indexOpen: indexPrice,
      indexHigh: indexPrice,
      indexLow: indexPrice,
      indexClose: indexPrice,
      observationCount: BigInt(1),
      periodStart: periodStart,
      periodEnd: periodEnd,
    };
  } else {
    candle = {
      ...candle,
      highPrice: spotPrice > candle.highPrice ? spotPrice : candle.highPrice,
      lowPrice: spotPrice < candle.lowPrice ? spotPrice : candle.lowPrice,
      closePrice: spotPrice,
      indexHigh:
        indexPrice && candle.indexHigh && indexPrice > candle.indexHigh
          ? indexPrice
          : candle.indexHigh,
      indexLow:
        indexPrice && candle.indexLow && indexPrice < candle.indexLow
          ? indexPrice
          : candle.indexLow,
      indexClose: indexPrice,
      observationCount: candle.observationCount + BigInt(1),
    };
  }

  context.PriceCandle.set(candle);
}

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
