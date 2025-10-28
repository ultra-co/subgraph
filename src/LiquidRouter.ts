import {
  LiquidRouter,
  LiquidRouter_ExpiredPositionSettled,
  LiquidRouter_FundingPaid,
  LiquidRouter_FundingReceived,
  LiquidRouter_OwnershipHandoverCanceled,
  LiquidRouter_OwnershipHandoverRequested,
  LiquidRouter_OwnershipTransferred,
  LiquidRouter_PositionAutoClosedInsufficientFunding,
  LiquidRouter_PositionClosed,
  LiquidRouter_PositionOpened,
  Position,
  Trader,
  Funding,
} from "generated";

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

    // Update trader stats
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

      // Update trader stats
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

    // Update trader stats
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

  // Create Position entity
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
});
