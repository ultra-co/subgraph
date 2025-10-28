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
  ClosedReason,
} from "generated";

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

  if (position) {
    const updatedPosition: Position = {
      ...position,
      pnl: event.params.pnl,
      netReturn: event.params.netReturn,
      closedAt: BigInt(event.block.timestamp),
      closeBlockNumber: BigInt(event.block.number),
      closeTransactionHash: event.transaction.hash,
      closed: true,
      closedReason: ClosedReason.EXPIRED,
      expiredPosition_id: eventId,
    };

    context.Position.set(updatedPosition);
  }
});

LiquidRouter.FundingPaid.handler(async ({ event, context }) => {
  const entity: LiquidRouter_FundingPaid = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    amount: event.params.amount,
  };

  context.LiquidRouter_FundingPaid.set(entity);
});

LiquidRouter.FundingReceived.handler(async ({ event, context }) => {
  const entity: LiquidRouter_FundingReceived = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    amount: event.params.amount,
  };

  context.LiquidRouter_FundingReceived.set(entity);
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

    if (position) {
      const updatedPosition: Position = {
        ...position,
        remainingValue: event.params.remainingValue,
        closedAt: BigInt(event.block.timestamp),
        closeBlockNumber: BigInt(event.block.number),
        closeTransactionHash: event.transaction.hash,
        closed: true,
        closedReason: ClosedReason.INSUFFICIENT_FUNDING,
        closedPosition_id: eventId,
      };

      context.Position.set(updatedPosition);
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

  if (position) {
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
      closedReason: ClosedReason.MANUAL,
      closedPosition_id: eventId,
    };

    context.Position.set(updatedPosition);
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

  const position: Position = {
    id: `${event.chainId}_${event.params.positionKey}`,
    positionKey: event.params.positionKey,
    user: event.params.user,
    market_id: `${event.chainId}_${event.params.marketId}`,

    collateral: event.params.collateral,
    size: event.params.size,
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
