import {
  LiquidRouter,
  LiquidRouter_ExpiredPositionSettled,
  LiquidRouter_FundingPaid,
  LiquidRouter_FundingReceived,
  LiquidRouter_MarginAdded,
  LiquidRouter_MarginRemoved,
  LiquidRouter_OwnershipHandoverCanceled,
  LiquidRouter_OwnershipHandoverRequested,
  LiquidRouter_OwnershipTransferred,
  LiquidRouter_PositionAutoClosedInsufficientFunding,
  LiquidRouter_PositionClosed,
  LiquidRouter_PositionOpened,
  Position,
  Trader,
  Funding,
  MarginUpdate,
  Market,
  PositionPnLSnapshot,
  MarketPositionTracker,
  TraderPositionTracker,
} from "generated";
import { getIndexPrice } from "./effects/getPrice";
import {
  calculatePositionPnl,
  calculatePnlPercentage,
} from "./utils/priceHelpers";

/**
 * Leverage precision constant for accurate decimal calculations with BigInt.
 *
 * Leverage can be fractional (e.g., 10.5x, 7.25x), so we use 18 decimal precision:
 * - Store: leverage = (size * LEVERAGE_PRECISION) / collateral
 * - Display: actualLeverage = leverage / 1e18
 *
 * Example: 10.5x leverage is stored as 10.5e18 = 10,500,000,000,000,000,000
 */
const LEVERAGE_PRECISION = BigInt(1e18);

/**
 * Add a position to the market's open position tracker.
 * This allows us to efficiently find all open positions for PnL snapshot creation.
 */
export async function addPositionToMarketTracker(
  context: any,
  marketId: string,
  positionId: string,
  timestamp: bigint
) {
  const trackerId = marketId;
  let tracker = await context.MarketPositionTracker.get(trackerId);

  if (!tracker) {
    tracker = {
      id: trackerId,
      market_id: marketId,
      openPositionIds: positionId,
      openPositionCount: BigInt(1),
      lastUpdatedAt: timestamp,
    };
  } else {
    const updatedIds = tracker.openPositionIds
      ? `${tracker.openPositionIds},${positionId}`
      : positionId;

    tracker = {
      ...tracker,
      openPositionIds: updatedIds,
      openPositionCount: tracker.openPositionCount + BigInt(1),
      lastUpdatedAt: timestamp,
    };
  }

  context.MarketPositionTracker.set(tracker);
}

/**
 * Remove a position from the market's open position tracker.
 */
export async function removePositionFromMarketTracker(
  context: any,
  marketId: string,
  positionId: string,
  timestamp: bigint
) {
  const trackerId = marketId;
  const tracker = await context.MarketPositionTracker.get(trackerId);

  if (!tracker) {
    return;
  }

  const positionIds = tracker.openPositionIds.split(",");
  const updatedIds = positionIds
    .filter((id: string) => id !== positionId)
    .join(",");

  const updatedTracker: MarketPositionTracker = {
    ...tracker,
    openPositionIds: updatedIds,
    openPositionCount:
      tracker.openPositionCount > BigInt(0)
        ? tracker.openPositionCount - BigInt(1)
        : BigInt(0),
    lastUpdatedAt: timestamp,
  };

  context.MarketPositionTracker.set(updatedTracker);
}

/**
 * Add a position to the trader's position tracker.
 */
export async function addPositionToTraderTracker(
  context: any,
  traderId: string,
  positionId: string,
  timestamp: bigint
) {
  const trackerId = traderId;
  let tracker = await context.TraderPositionTracker.get(trackerId);

  if (!tracker) {
    tracker = {
      id: trackerId,
      trader_id: traderId,
      openPositionIds: positionId,
      openPositionCount: BigInt(1),
      lastUpdatedAt: timestamp,
    };
  } else {
    const updatedIds = tracker.openPositionIds
      ? `${tracker.openPositionIds},${positionId}`
      : positionId;

    tracker = {
      ...tracker,
      openPositionIds: updatedIds,
      openPositionCount: tracker.openPositionCount + BigInt(1),
      lastUpdatedAt: timestamp,
    };
  }

  context.TraderPositionTracker.set(tracker);
}

/**
 * Remove a position from the trader's position tracker.
 */
export async function removePositionFromTraderTracker(
  context: any,
  traderId: string,
  positionId: string,
  timestamp: bigint
) {
  const trackerId = traderId;
  const tracker = await context.TraderPositionTracker.get(trackerId);

  if (!tracker) {
    return;
  }

  const positionIds = tracker.openPositionIds.split(",");
  const updatedIds = positionIds
    .filter((id: string) => id !== positionId)
    .join(",");

  const updatedTracker: TraderPositionTracker = {
    ...tracker,
    openPositionIds: updatedIds,
    openPositionCount:
      tracker.openPositionCount > BigInt(0)
        ? tracker.openPositionCount - BigInt(1)
        : BigInt(0),
    lastUpdatedAt: timestamp,
  };

  context.TraderPositionTracker.set(updatedTracker);
}

/**
 * Create a PnL snapshot for a position at the current market price.
 * This is called on every price update to enable PnL charting.
 */
export async function createPositionPnLSnapshot(
  context: any,
  position: Position,
  currentIndexPrice: bigint,
  timestamp: bigint,
  blockNumber: bigint,
  chainId: number
) {
  // Only create snapshots for open positions with valid prices
  if (position.closed || currentIndexPrice === BigInt(0)) {
    return;
  }

  const pnl = calculatePositionPnl(position, currentIndexPrice);
  const pnlPercentage = calculatePnlPercentage(pnl, position.collateral);

  const snapshot: PositionPnLSnapshot = {
    id: `${chainId}_${position.id}_${timestamp}`,
    position_id: position.id,
    trader_id: position.trader_id,
    pnl,
    pnlPercentage,
    indexPrice: currentIndexPrice,
    timestamp,
    blockNumber,
  };

  context.PositionPnLSnapshot.set(snapshot);
}

LiquidRouter.ExpiredPositionSettled.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_ExpiredPositionSettled = {
    id: eventId,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    pnl: event.params.pnl,
    netReturn: event.params.netReturn,
  };

  context.LiquidRouter_ExpiredPositionSettled.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;
  const position = await context.Position.get(positionId);

  if (position && !position.closed) {
    const updatedPosition: Position = {
      ...position,
      pnl: event.params.pnl,
      netReturn: event.params.netReturn,
      closedAt: BigInt(event.block.timestamp),
      closeBlockNumber: BigInt(event.block.number),
      closeTransactionHash: event.transaction.hash,
      closed: true,
      closedReason: "EXPIRED",
      expiredPosition_id: eventId,
    };

    context.Position.set(updatedPosition);

    // Remove from trackers
    await removePositionFromMarketTracker(
      context,
      position.market_id,
      positionId,
      BigInt(event.block.timestamp)
    );
    await removePositionFromTraderTracker(
      context,
      position.trader_id,
      positionId,
      BigInt(event.block.timestamp)
    );

    // Update trader stats with realized PnL
    const trader = await context.Trader.get(position.trader_id);
    if (trader) {
      const newOpenPositions =
        trader.openPositions > BigInt(0)
          ? trader.openPositions - BigInt(1)
          : BigInt(0);
      const newRealizedPnl = trader.realizedPnl + event.params.pnl;

      const updatedTrader: Trader = {
        ...trader,
        openPositions: newOpenPositions,
        closedPositions: trader.closedPositions + BigInt(1),
        realizedPnl: newRealizedPnl,
        lastTradedAt: BigInt(event.block.timestamp),
      };
      context.Trader.set(updatedTrader);
    }

    // Update market volume (add position size for expired position)
    const market = await context.Market.get(position.market_id);
    if (market) {
      const updatedMarket: Market = {
        ...market,
        volume: market.volume + position.size,
        collateralVolume: market.collateralVolume + position.collateral,
      };
      context.Market.set(updatedMarket);
    }
  }
});

LiquidRouter.FundingPaid.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_FundingPaid = {
    id: eventId,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    amount: event.params.amount,
  };

  context.LiquidRouter_FundingPaid.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;

  // Create Funding entity
  const funding: Funding = {
    id: eventId,
    trader_id: `${event.chainId}_${event.params.trader}`,
    position_id: positionId,
    market_id: `${event.chainId}_${event.params.marketId}`,
    fundingType: "PAID",
    amount: event.params.amount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.Funding.set(funding);

  // Update position collateral - decrease when funding is paid
  const position = await context.Position.get(positionId);

  if (position) {
    const updatedPosition: Position = {
      ...position,
      collateral: position.collateral - event.params.amount,
    };
    context.Position.set(updatedPosition);
  }
});

LiquidRouter.FundingReceived.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_FundingReceived = {
    id: eventId,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    amount: event.params.amount,
  };

  context.LiquidRouter_FundingReceived.set(eventEntity);
  const positionId = `${event.chainId}_${event.params.positionKey}`;

  // Create Funding entity
  const funding: Funding = {
    id: eventId,
    trader_id: `${event.chainId}_${event.params.trader}`,
    position_id: positionId,
    market_id: `${event.chainId}_${event.params.marketId}`,
    fundingType: "RECEIVED",
    amount: event.params.amount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.Funding.set(funding);

  // Update position collateral - increase when funding is received
  const position = await context.Position.get(positionId);

  if (position) {
    const updatedPosition: Position = {
      ...position,
      collateral: position.collateral + event.params.amount,
    };
    context.Position.set(updatedPosition);
  }
});

LiquidRouter.MarginAdded.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_MarginAdded = {
    id: eventId,
    user: event.params.user,
    positionKey: event.params.positionKey,
    additionalCollateral: event.params.additionalCollateral,
    newTotalCollateral: event.params.newTotalCollateral,
  };

  context.LiquidRouter_MarginAdded.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;
  const position = await context.Position.get(positionId);

  if (position && !position.closed) {
    const updatedPosition: Position = {
      ...position,
      collateral: event.params.newTotalCollateral,
    };

    context.Position.set(updatedPosition);

    const trader = await context.Trader.get(position.trader_id);
    if (trader) {
      const updatedTrader: Trader = {
        ...trader,
        totalVolume: trader.totalVolume + event.params.additionalCollateral,
        lastTradedAt: BigInt(event.block.timestamp),
      };
      context.Trader.set(updatedTrader);
    }

    // Update market volume (add additional collateral)
    const market = await context.Market.get(position.market_id);
    if (market) {
      const updatedMarket: Market = {
        ...market,
        volume: market.volume + event.params.additionalCollateral,
        collateralVolume:
          market.collateralVolume + event.params.additionalCollateral,
      };
      context.Market.set(updatedMarket);
    }

    const marginUpdate: MarginUpdate = {
      id: eventId,
      position_id: positionId,
      trader_id: position.trader_id,
      updateType: "ADDED",
      amount: event.params.additionalCollateral,
      newTotalCollateral: event.params.newTotalCollateral,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    };

    context.MarginUpdate.set(marginUpdate);
  }
});

LiquidRouter.MarginRemoved.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_MarginRemoved = {
    id: eventId,
    user: event.params.user,
    positionKey: event.params.positionKey,
    collateralRemoved: event.params.collateralRemoved,
    newTotalCollateral: event.params.newTotalCollateral,
  };

  context.LiquidRouter_MarginRemoved.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;
  const position = await context.Position.get(positionId);

  if (position && !position.closed) {
    const updatedPosition: Position = {
      ...position,
      collateral: event.params.newTotalCollateral,
    };

    context.Position.set(updatedPosition);

    const trader = await context.Trader.get(position.trader_id);
    if (trader) {
      const newTotalVolume =
        trader.totalVolume > event.params.collateralRemoved
          ? trader.totalVolume - event.params.collateralRemoved
          : BigInt(0);

      const updatedTrader: Trader = {
        ...trader,
        totalVolume: newTotalVolume,
        lastTradedAt: BigInt(event.block.timestamp),
      };
      context.Trader.set(updatedTrader);
    }

    // Update market volume (add removed collateral to volume)
    const market = await context.Market.get(position.market_id);
    if (market) {
      const updatedMarket: Market = {
        ...market,
        volume: market.volume + event.params.collateralRemoved,
        collateralVolume:
          market.collateralVolume + event.params.collateralRemoved,
      };
      context.Market.set(updatedMarket);
    }

    const marginUpdate: MarginUpdate = {
      id: eventId,
      position_id: positionId,
      trader_id: position.trader_id,
      updateType: "REMOVED",
      amount: event.params.collateralRemoved,
      newTotalCollateral: event.params.newTotalCollateral,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    };

    context.MarginUpdate.set(marginUpdate);
  }
});

LiquidRouter.OwnershipHandoverCanceled.handler(async ({ event, context }) => {
  const entity: LiquidRouter_OwnershipHandoverCanceled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    pendingOwner: event.params.pendingOwner,
  };

  context.LiquidRouter_OwnershipHandoverCanceled.set(entity);
});

LiquidRouter.OwnershipHandoverRequested.handler(async ({ event, context }) => {
  const entity: LiquidRouter_OwnershipHandoverRequested = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    pendingOwner: event.params.pendingOwner,
  };

  context.LiquidRouter_OwnershipHandoverRequested.set(entity);
});

LiquidRouter.OwnershipTransferred.handler(async ({ event, context }) => {
  const entity: LiquidRouter_OwnershipTransferred = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    oldOwner: event.params.oldOwner,
    newOwner: event.params.newOwner,
  };

  context.LiquidRouter_OwnershipTransferred.set(entity);
});

LiquidRouter.PositionAutoClosedInsufficientFunding.handler(
  async ({ event, context }) => {
    const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
    const eventEntity: LiquidRouter_PositionAutoClosedInsufficientFunding = {
      id: eventId,
      positionKey: event.params.positionKey,
      trader: event.params.trader,
      marketId: event.params.marketId,
      remainingValue: event.params.remainingValue,
    };

    context.LiquidRouter_PositionAutoClosedInsufficientFunding.set(eventEntity);

    const positionId = `${event.chainId}_${event.params.positionKey}`;
    const position = await context.Position.get(positionId);

    if (position && !position.closed) {
      const updatedPosition: Position = {
        ...position,
        remainingValue: event.params.remainingValue,
        closedAt: BigInt(event.block.timestamp),
        closeBlockNumber: BigInt(event.block.number),
        closeTransactionHash: event.transaction.hash,
        closed: true,
        closedReason: "INSUFFICIENT_FUNDING",
        closedPosition_id: eventId,
      };

      context.Position.set(updatedPosition);

      // Remove from tracker
      await removePositionFromMarketTracker(
        context,
        position.market_id,
        positionId,
        BigInt(event.block.timestamp)
      );

      // Update trader stats with realized PnL (no PnL in insufficient funding event)
      const trader = await context.Trader.get(position.trader_id);
      if (trader) {
        const newOpenPositions =
          trader.openPositions > BigInt(0)
            ? trader.openPositions - BigInt(1)
            : BigInt(0);
        const updatedTrader: Trader = {
          ...trader,
          openPositions: newOpenPositions,
          closedPositions: trader.closedPositions + BigInt(1),
          lastTradedAt: BigInt(event.block.timestamp),
        };
        context.Trader.set(updatedTrader);
      }

      // Update market volume (add position size for auto-closed position)
      const market = await context.Market.get(position.market_id);
      if (market) {
        const updatedMarket: Market = {
          ...market,
          volume: market.volume + position.size,
          collateralVolume: market.collateralVolume + position.collateral,
        };
        context.Market.set(updatedMarket);
      }
    }
  }
);

LiquidRouter.PositionClosed.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_PositionClosed = {
    id: eventId,
    user: event.params.user,
    positionKey: event.params.positionKey,
    pnl: event.params.pnl,
    totalFee: event.params.totalFee,
    lpFee: event.params.lpFee,
    protocolFee: event.params.protocolFee,
    netReturn: event.params.netReturn,
  };

  context.LiquidRouter_PositionClosed.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;
  const position = await context.Position.get(positionId);

  if (position && !position.closed) {
    const updatedPosition: Position = {
      ...position,
      pnl: event.params.pnl,
      closeTotalFee: event.params.totalFee,
      closeLpFee: event.params.lpFee,
      closeProtocolFee: event.params.protocolFee,
      netReturn: event.params.netReturn,
      closedAt: BigInt(event.block.timestamp),
      closeBlockNumber: BigInt(event.block.number),
      closeTransactionHash: event.transaction.hash,
      closed: true,
      closedReason: "MANUAL",
      closedPosition_id: eventId,
    };

    context.Position.set(updatedPosition);

    // Remove from trackers
    await removePositionFromMarketTracker(
      context,
      position.market_id,
      positionId,
      BigInt(event.block.timestamp)
    );
    await removePositionFromTraderTracker(
      context,
      position.trader_id,
      positionId,
      BigInt(event.block.timestamp)
    );

    // Update trader stats with realized PnL
    const trader = await context.Trader.get(position.trader_id);
    if (trader) {
      const newOpenPositions =
        trader.openPositions > BigInt(0)
          ? trader.openPositions - BigInt(1)
          : BigInt(0);
      const newRealizedPnl = trader.realizedPnl + event.params.pnl;

      const updatedTrader: Trader = {
        ...trader,
        openPositions: newOpenPositions,
        closedPositions: trader.closedPositions + BigInt(1),
        realizedPnl: newRealizedPnl,
        lastTradedAt: BigInt(event.block.timestamp),
      };
      context.Trader.set(updatedTrader);
    }

    // Update market volume (add position size for closed position)
    const market = await context.Market.get(position.market_id);
    if (market) {
      const updatedMarket: Market = {
        ...market,
        volume: market.volume + position.size,
        collateralVolume: market.collateralVolume + position.collateral,
      };
      context.Market.set(updatedMarket);
    }
  }
});

LiquidRouter.PositionOpened.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidRouter_PositionOpened = {
    id: eventId,
    user: event.params.user,
    positionKey: event.params.positionKey,
    marketId: event.params.marketId,
    collateral: event.params.collateral,
    size: event.params.size,
    isLong: event.params.isLong,
    totalFee: event.params.totalFee,
    lpFee: event.params.lpFee,
    protocolFee: event.params.protocolFee,
  };

  context.LiquidRouter_PositionOpened.set(eventEntity);

  // Get or create Trader entity
  const traderId = `${event.chainId}_${event.params.user}`;
  let trader = await context.Trader.get(traderId);

  if (!trader) {
    // Create new trader
    trader = {
      id: traderId,
      address: event.params.user,
      totalPositions: BigInt(0),
      openPositions: BigInt(0),
      closedPositions: BigInt(0),
      liquidatedPositions: BigInt(0),
      totalVolume: BigInt(0),
      realizedPnl: BigInt(0),
      firstTradedAt: BigInt(event.block.timestamp),
      lastTradedAt: BigInt(event.block.timestamp),
    };
  }

  // Update trader stats for opening position
  const updatedTrader: Trader = {
    ...trader,
    totalPositions: trader.totalPositions + BigInt(1),
    openPositions: trader.openPositions + BigInt(1),
    totalVolume: trader.totalVolume + event.params.size,
    lastTradedAt: BigInt(event.block.timestamp),
  };

  context.Trader.set(updatedTrader);

  const marketFullId = `${event.chainId}_${event.params.marketId}`;
  let market = await context.Market.get(marketFullId);

  if (!market) {
    context.log.warn(
      `Market ${marketFullId} not found, skipping position creation`
    );
    return;
  }

  // Update market volume
  const updatedMarket: Market = {
    ...market,
    volume: market.volume + event.params.size,
    collateralVolume: market.collateralVolume + event.params.collateral,
  };

  context.Market.set(updatedMarket);

  const indexPriceResult = await context.effect(getIndexPrice, {
    marketId: event.params.marketId,
    blockNumber: event.block.number,
  });

  const entryIndexPrice = indexPriceResult
    ? BigInt(indexPriceResult)
    : BigInt(0);

  // Calculate leverage: (size * LEVERAGE_PRECISION) / collateral
  const leverage =
    event.params.collateral > BigInt(0)
      ? (event.params.size * LEVERAGE_PRECISION) / event.params.collateral
      : BigInt(0);

  const position: Position = {
    id: `${event.chainId}_${event.params.positionKey}`,
    positionKey: event.params.positionKey,
    trader_id: traderId,
    market_id: `${event.chainId}_${event.params.marketId}`,

    collateral: event.params.collateral,
    size: event.params.size,
    leverage: leverage,
    isLong: event.params.isLong,
    openTotalFee: event.params.totalFee,
    openLpFee: event.params.lpFee,
    openProtocolFee: event.params.protocolFee,
    openedAt: BigInt(event.block.timestamp),
    openBlockNumber: BigInt(event.block.number),
    openTransactionHash: event.transaction.hash,

    entryIndexPrice: entryIndexPrice,

    pnl: undefined,
    closeTotalFee: undefined,
    closeLpFee: undefined,
    closeProtocolFee: undefined,
    netReturn: undefined,
    closedAt: undefined,
    closeBlockNumber: undefined,
    closeTransactionHash: undefined,

    closed: false,
    liquidated: false,
    closedReason: undefined,
    liquidatedAt: undefined,
    liquidationBlockNumber: undefined,
    liquidationTransactionHash: undefined,

    remainingValue: undefined,

    openedPosition_id: eventId,
    closedPosition_id: undefined,
    liquidatedPosition_id: undefined,
    expiredPosition_id: undefined,
  };

  context.Position.set(position);

  // Add to market and trader trackers for PnL snapshot creation
  await addPositionToMarketTracker(
    context,
    `${event.chainId}_${event.params.marketId}`,
    position.id,
    BigInt(event.block.timestamp)
  );

  await addPositionToTraderTracker(
    context,
    traderId,
    position.id,
    BigInt(event.block.timestamp)
  );

  context.log.info(
    `Added position ${position.id} to market and trader trackers`
  );

  // Create initial PnL snapshot at position opening
  await createPositionPnLSnapshot(
    context,
    position,
    entryIndexPrice,
    BigInt(event.block.timestamp),
    BigInt(event.block.number),
    event.chainId
  );
});
