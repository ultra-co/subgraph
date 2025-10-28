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
} from "generated";

LiquidRouter.ExpiredPositionSettled.handler(async ({ event, context }) => {
  const entity: LiquidRouter_ExpiredPositionSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    pnl: event.params.pnl,
    netReturn: event.params.netReturn,
  };

  context.LiquidRouter_ExpiredPositionSettled.set(entity);
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
    const entity: LiquidRouter_PositionAutoClosedInsufficientFunding = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      positionKey: event.params.positionKey,
      trader: event.params.trader,
      marketId: event.params.marketId,
      remainingValue: event.params.remainingValue,
    };

    context.LiquidRouter_PositionAutoClosedInsufficientFunding.set(entity);
  }
);

LiquidRouter.PositionClosed.handler(async ({ event, context }) => {
  const entity: LiquidRouter_PositionClosed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user,
    positionKey: event.params.positionKey,
    pnl: event.params.pnl,
    totalFee: event.params.totalFee,
    lpFee: event.params.lpFee,
    protocolFee: event.params.protocolFee,
    netReturn: event.params.netReturn,
  };

  context.LiquidRouter_PositionClosed.set(entity);
});

LiquidRouter.PositionOpened.handler(async ({ event, context }) => {
  const entity: LiquidRouter_PositionOpened = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
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

  context.LiquidRouter_PositionOpened.set(entity);
});
