import {
  LiquidationEngine,
  LiquidationEngine_KeeperRewardsClaimed,
  LiquidationEngine_ParametersUpdated,
  LiquidationEngine_PositionLiquidated,
  Position,
  ClosedReason,
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
      closedReason: ClosedReason.LIQUIDATED,
      liquidatedAt: BigInt(event.block.timestamp),
      liquidationBlockNumber: BigInt(event.block.number),
      liquidationTransactionHash: event.transaction.hash,
      liquidatedPosition_id: eventId,
    };

    context.Position.set(updatedPosition);
  }
});
