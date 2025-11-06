import {
  ProbabilityOracle,
  ProbabilityOracle_MarketSourceInitialized,
  ProbabilityOracle_PriceUpdated,
  ProbabilityOracle_PriceUpdaterChanged,
  ProbabilityOracle_TWAPPeriodUpdated,
  Market,
  PriceObservation,
  PriceCandle,
  MarketPositionTracker,
  TraderPnLSnapshot,
} from "generated";
import { getIndexPrice } from "./effects/getPrice";
import { getMarketMetadata } from "./effects/getMarketMetadata";
import {
  MARKET_CONTEXT,
  MARKET_QUESTIONS,
  MARKET_RESOLUTION,
} from "./constants/marketQuestions";
import {
  getPeriodStart,
  getPeriodDuration,
  calculatePositionPnl,
} from "./utils/priceHelpers";
import { createPositionPnLSnapshot } from "./LiquidRouter";

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

  // check and update market context if missing
  let marketContext = market.context;
  if (!marketContext || marketContext.trim() === "") {
    const contextForMarket = MARKET_CONTEXT[event.params.marketId];
    if (contextForMarket) {
      marketContext = contextForMarket;
    }
  }

  // check and update market resolution if missing
  let marketResolution = market.resolution;
  if (!marketResolution || marketResolution.trim() === "") {
    const resolutionForMarket = MARKET_RESOLUTION[event.params.marketId];
    if (resolutionForMarket) {
      marketResolution = resolutionForMarket;
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
    context: marketContext,
    resolution: marketResolution,
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
      indexPrice,
      updatedMarket.collateralVolume
    );
  }

  // Create PnL snapshots for all open positions at this price update
  if (indexPrice > BigInt(0)) {
    await createPnLSnapshotsForMarket(
      context,
      marketFullId,
      indexPrice,
      event.params.timestamp,
      event.block.number,
      event.chainId
    );
  }
});

async function updateCandle(
  context: any,
  marketId: string,
  interval: string,
  timestamp: bigint,
  spotPrice: bigint,
  indexPrice: bigint | undefined,
  marketCollateralVolume: bigint
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
      volume: marketCollateralVolume,
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
      volume: marketCollateralVolume,
      observationCount: candle.observationCount + BigInt(1),
    };
  }

  context.PriceCandle.set(candle);
}

/**
 * Create PnL snapshots for all open positions in a market.
 * Called on every price update to enable continuous PnL charting.
 * Also creates aggregated trader PnL snapshots.
 */
async function createPnLSnapshotsForMarket(
  context: any,
  marketId: string,
  indexPrice: bigint,
  timestamp: bigint,
  blockNumber: number,
  chainId: number
) {
  // Get the tracker for this market
  const tracker = await context.MarketPositionTracker.get(marketId);

  if (!tracker || !tracker.openPositionIds || tracker.openPositionIds === "") {
    // No open positions for this market
    return;
  }

  // Parse the comma-separated list of position IDs
  const positionIds = tracker.openPositionIds.split(",");

  // Track trader data for aggregation
  const traderData = new Map<
    string,
    { unrealizedPnl: bigint; totalCollateral: bigint }
  >();

  // Track which traders we've seen (to aggregate across all their positions)
  const tradersToUpdate = new Set<string>();

  // Create a snapshot for each open position in THIS market
  for (const positionId of positionIds) {
    if (!positionId) continue; // Skip empty strings

    const position = await context.Position.get(positionId);

    if (position && !position.closed) {
      await createPositionPnLSnapshot(
        context,
        position,
        indexPrice,
        timestamp,
        BigInt(blockNumber),
        chainId
      );

      // Track which traders need snapshots
      tradersToUpdate.add(position.trader_id);
    }
  }

  // Create trader PnL snapshots - aggregate across ALL markets
  for (const traderId of tradersToUpdate) {
    await createTraderPnLSnapshotForAllPositions(
      context,
      traderId,
      timestamp,
      blockNumber,
      chainId
    );
  }
}

/**
 * Create a trader PnL snapshot by querying ALL their open positions across ALL markets.
 * Uses TraderPositionTracker to efficiently find all positions.
 */
async function createTraderPnLSnapshotForAllPositions(
  context: any,
  traderId: string,
  timestamp: bigint,
  blockNumber: number,
  chainId: number
) {
  const trader = await context.Trader.get(traderId);

  if (!trader) {
    return;
  }

  // Get trader's position tracker to find ALL open positions
  const traderTracker = await context.TraderPositionTracker.get(traderId);

  let totalUnrealizedPnl = BigInt(0);
  let totalCollateral = BigInt(0);

  if (traderTracker && traderTracker.openPositionIds) {
    // Parse all position IDs
    const positionIds = traderTracker.openPositionIds.split(",");

    // Calculate PnL across ALL positions (all markets)
    for (const positionId of positionIds) {
      if (!positionId) continue;

      const position = await context.Position.get(positionId);

      if (position && !position.closed) {
        // Get latest price for this position's market
        const market = await context.Market.get(position.market_id);
        const marketIndexPrice = market?.indexPrice || position.entryIndexPrice;

        const positionPnl = calculatePositionPnl(position, marketIndexPrice);
        totalUnrealizedPnl += positionPnl;
        totalCollateral += position.collateral;
      }
    }
  }

  // Total PnL = realized + unrealized across all positions
  const totalPnl = trader.realizedPnl + totalUnrealizedPnl;

  // PnL percentage based on total deployed capital
  const pnlPercentage =
    totalCollateral > BigInt(0)
      ? (totalPnl * BigInt(1e18)) / totalCollateral
      : BigInt(0);

  const snapshot: TraderPnLSnapshot = {
    id: `${chainId}_${traderId}_${timestamp}`,
    trader_id: traderId,
    pnl: totalPnl,
    pnlPercentage,
    capitalDeployed: totalCollateral,
    positionCount: trader.openPositions,
    timestamp,
    blockNumber: BigInt(blockNumber),
  };

  context.TraderPnLSnapshot.set(snapshot);
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
