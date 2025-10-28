import {
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
} from "generated";

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
