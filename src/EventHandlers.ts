/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  FundingRateManager,
  FundingRateManager_FundingRateCalculated,
  LLPVault,
  LLPVault_Deposit,
  LLPVault_DepositsPaused,
  LLPVault_FeeUpdated,
  LLPVault_FundingPaymentRecorded,
  LLPVault_LiquidationFeePaid,
  LLPVault_TraderPnLSettled,
  LLPVault_TradingFeePaid,
  LLPVault_Transfer,
  LLPVault_Withdraw,
  LLPVault_WithdrawalsPaused,
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
  LiquidationEngine,
  LiquidationEngine_KeeperRewardsClaimed,
  LiquidationEngine_ParametersUpdated,
  LiquidationEngine_PositionLiquidated,
  MarketFactory,
  MarketFactory_MarketCreated,
  ProbabilityOracle,
  ProbabilityOracle_MarketSourceInitialized,
  ProbabilityOracle_PriceUpdated,
  ProbabilityOracle_PriceUpdaterChanged,
  ProbabilityOracle_TWAPPeriodUpdated,
} from "generated";

FundingRateManager.FundingRateCalculated.handler(async ({ event, context }) => {
  const entity: FundingRateManager_FundingRateCalculated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    fundingRate: event.params.fundingRate,
    skew: event.params.skew,
    timestamp: event.params.timestamp,
  };

  context.FundingRateManager_FundingRateCalculated.set(entity);
});

LLPVault.Deposit.handler(async ({ event, context }) => {
  const entity: LLPVault_Deposit = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    by: event.params.by,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
  };

  context.LLPVault_Deposit.set(entity);
});

LLPVault.DepositsPaused.handler(async ({ event, context }) => {
  const entity: LLPVault_DepositsPaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    paused: event.params.paused,
  };

  context.LLPVault_DepositsPaused.set(entity);
});

LLPVault.FeeUpdated.handler(async ({ event, context }) => {
  const entity: LLPVault_FeeUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    feeType: event.params.feeType,
    newRate: event.params.newRate,
  };

  context.LLPVault_FeeUpdated.set(entity);
});

LLPVault.FundingPaymentRecorded.handler(async ({ event, context }) => {
  const entity: LLPVault_FundingPaymentRecorded = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    netFundingPnL: event.params.netFundingPnL,
    newTotalAssets: event.params.newTotalAssets,
  };

  context.LLPVault_FundingPaymentRecorded.set(entity);
});

LLPVault.LiquidationFeePaid.handler(async ({ event, context }) => {
  const entity: LLPVault_LiquidationFeePaid = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
  };

  context.LLPVault_LiquidationFeePaid.set(entity);
});

LLPVault.TraderPnLSettled.handler(async ({ event, context }) => {
  const entity: LLPVault_TraderPnLSettled = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    pnl: event.params.pnl,
    newTotalAssets: event.params.newTotalAssets,
  };

  context.LLPVault_TraderPnLSettled.set(entity);
});

LLPVault.TradingFeePaid.handler(async ({ event, context }) => {
  const entity: LLPVault_TradingFeePaid = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    amount: event.params.amount,
  };

  context.LLPVault_TradingFeePaid.set(entity);
});

LLPVault.Transfer.handler(async ({ event, context }) => {
  const entity: LLPVault_Transfer = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    from: event.params.from,
    to: event.params.to,
    amount: event.params.amount,
  };

  context.LLPVault_Transfer.set(entity);
});

LLPVault.Withdraw.handler(async ({ event, context }) => {
  const entity: LLPVault_Withdraw = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    by: event.params.by,
    to: event.params.to,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
  };

  context.LLPVault_Withdraw.set(entity);
});

LLPVault.WithdrawalsPaused.handler(async ({ event, context }) => {
  const entity: LLPVault_WithdrawalsPaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    paused: event.params.paused,
  };

  context.LLPVault_WithdrawalsPaused.set(entity);
});

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

LiquidRouter.PositionAutoClosedInsufficientFunding.handler(async ({ event, context }) => {
  const entity: LiquidRouter_PositionAutoClosedInsufficientFunding = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    marketId: event.params.marketId,
    remainingValue: event.params.remainingValue,
  };

  context.LiquidRouter_PositionAutoClosedInsufficientFunding.set(entity);
});

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
  const entity: LiquidationEngine_PositionLiquidated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionKey: event.params.positionKey,
    trader: event.params.trader,
    liquidator: event.params.liquidator,
    collateralSeized: event.params.collateralSeized,
    keeperReward: event.params.keeperReward,
    penaltyToVault: event.params.penaltyToVault,
  };

  context.LiquidationEngine_PositionLiquidated.set(entity);
});

MarketFactory.MarketCreated.handler(async ({ event, context }) => {
  const entity: MarketFactory_MarketCreated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    name: event.params.name,
    sourcePlatform: event.params.sourcePlatform,
    sourceMarketId: event.params.sourceMarketId,
    expiryTimestamp: event.params.expiryTimestamp,
    creator: event.params.creator,
  };

  context.MarketFactory_MarketCreated.set(entity);
});

ProbabilityOracle.MarketSourceInitialized.handler(async ({ event, context }) => {
  const entity: ProbabilityOracle_MarketSourceInitialized = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    sourcePlatform: event.params.sourcePlatform,
    sourceMarketId: event.params.sourceMarketId,
  };

  context.ProbabilityOracle_MarketSourceInitialized.set(entity);
});

ProbabilityOracle.PriceUpdated.handler(async ({ event, context }) => {
  const entity: ProbabilityOracle_PriceUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    marketId: event.params.marketId,
    price: event.params.price,
    timestamp: event.params.timestamp,
  };

  context.ProbabilityOracle_PriceUpdated.set(entity);
});

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
