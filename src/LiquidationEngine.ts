import {
  LiquidationEngine,
  LiquidationEngine_KeeperRewardsClaimed,
  LiquidationEngine_ParametersUpdated,
  LiquidationEngine_PositionLiquidated,
  Position,
  Trader,
} from "generated";

LiquidationEngine.KeeperRewardsClaimed.handler(async ({ event, context }) => {
  const entity: LiquidationEngine_KeeperRewardsClaimed = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    keeper: event.params.keeper,
    amount: event.params.amount,
  };

  context.LiquidationEngine_KeeperRewardsClaimed.set(entity);
});

LiquidationEngine.ParametersUpdated.handler(async ({ event, context }) => {
  const entity: LiquidationEngine_ParametersUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    maintenanceMarginRate: event.params.maintenanceMarginRate,
    liquidationPenaltyRate: event.params.liquidationPenaltyRate,
    keeperFee: event.params.keeperFee,
  };

  context.LiquidationEngine_ParametersUpdated.set(entity);
});

LiquidationEngine.PositionLiquidated.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LiquidationEngine_PositionLiquidated = {
    id: eventId,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    liquidator: event.params.liquidator,
    collateralSeized: event.params.collateralSeized,
    keeperReward: event.params.keeperReward,
    penaltyToVault: event.params.penaltyToVault,
  };

  context.LiquidationEngine_PositionLiquidated.set(eventEntity);

  const positionId = `${event.chainId}_${event.params.positionKey}`;
  const position = await context.Position.get(positionId);

  if (position) {
    const updatedPosition: Position = {
      ...position,
      closed: true,
      liquidated: true,
      closedReason: "LIQUIDATED",
      liquidatedAt: BigInt(event.block.timestamp),
      liquidationBlockNumber: BigInt(event.block.number),
      liquidationTransactionHash: event.transaction.hash,
      liquidatedPosition_id: eventId,
    };

    context.Position.set(updatedPosition);

    // Update trader stats
    const trader = await context.Trader.get(position.trader_id);
    if (trader) {
      const updatedTrader: Trader = {
        ...trader,
        openPositions: trader.openPositions - BigInt(1),
        liquidatedPositions: trader.liquidatedPositions + BigInt(1),
        lastTradedAt: BigInt(event.block.timestamp),
      };
      context.Trader.set(updatedTrader);
    }
  }
});
