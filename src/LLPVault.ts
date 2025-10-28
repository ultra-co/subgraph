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
  Vault,
  Shareholder,
  VaultDeposit,
  VaultWithdrawal,
  VaultRevenue,
} from "generated";

LLPVault.Deposit.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_Deposit = {
    id: eventId,
    by: event.params.by,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
  };

  context.LLPVault_Deposit.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  let vault = await context.Vault.get(vaultId);

  if (!vault) {
    vault = {
      id: vaultId,
      address: event.srcAddress,
      totalAssets: BigInt(0),
      totalShares: BigInt(0),
      sharePrice: BigInt(0),
      totalDepositsAmount: BigInt(0),
      totalWithdrawalsAmount: BigInt(0),
      netDeposits: BigInt(0),
      depositCount: BigInt(0),
      withdrawalCount: BigInt(0),
      tradingFeesCollected: BigInt(0),
      liquidationFeesCollected: BigInt(0),
      traderLossesCollected: BigInt(0),
      fundingFeesReceived: BigInt(0),
      fundingFeesPaid: BigInt(0),
      netFundingFees: BigInt(0),
      totalRevenue: BigInt(0),
      traderProfitsPaid: BigInt(0),
      netProfit: BigInt(0),
      depositFeeRate: BigInt(0),
      withdrawalFeeRate: BigInt(0),
      depositsPaused: false,
      withdrawalsPaused: false,
      createdAt: BigInt(event.block.timestamp),
      lastUpdatedAt: BigInt(event.block.timestamp),
    };
  }

  const updatedVault: Vault = {
    ...vault,
    totalAssets: vault.totalAssets + event.params.assets,
    totalShares: vault.totalShares + event.params.shares,
    sharePrice:
      vault.totalShares + event.params.shares > BigInt(0)
        ? (vault.totalAssets + event.params.assets) /
          (vault.totalShares + event.params.shares)
        : BigInt(0),
    totalDepositsAmount: vault.totalDepositsAmount + event.params.assets,
    depositCount: vault.depositCount + BigInt(1),
    netDeposits: vault.netDeposits + event.params.assets,
    lastUpdatedAt: BigInt(event.block.timestamp),
  };

  context.Vault.set(updatedVault);

  const shareholderId = `${event.chainId}_${event.params.owner}`;
  let shareholder = await context.Shareholder.get(shareholderId);

  if (!shareholder) {
    shareholder = {
      id: shareholderId,
      vault_id: vaultId,
      address: event.params.owner,
      currentShares: BigInt(0),
      estimatedValue: BigInt(0),
      totalDeposited: BigInt(0),
      totalWithdrawn: BigInt(0),
      netDeposits: BigInt(0),
      totalSharesReceived: BigInt(0),
      totalSharesBurned: BigInt(0),
      depositCount: BigInt(0),
      withdrawalCount: BigInt(0),
      transfersIn: BigInt(0),
      transfersOut: BigInt(0),
      averageDepositPrice: BigInt(0),
      unrealizedPnL: BigInt(0),
      firstDepositAt: BigInt(event.block.timestamp),
      lastActivityAt: BigInt(event.block.timestamp),
    };
  }

  const updatedShareholder: Shareholder = {
    ...shareholder,
    currentShares: shareholder.currentShares + event.params.shares,
    estimatedValue:
      (shareholder.currentShares + event.params.shares) *
      updatedVault.sharePrice,
    totalDeposited: shareholder.totalDeposited + event.params.assets,
    netDeposits: shareholder.netDeposits + event.params.assets,
    totalSharesReceived: shareholder.totalSharesReceived + event.params.shares,
    depositCount: shareholder.depositCount + BigInt(1),
    averageDepositPrice:
      shareholder.totalSharesReceived + event.params.shares > BigInt(0)
        ? (shareholder.totalDeposited + event.params.assets) /
          (shareholder.totalSharesReceived + event.params.shares)
        : BigInt(0),
    unrealizedPnL:
      (shareholder.currentShares + event.params.shares) *
        updatedVault.sharePrice -
      (shareholder.totalDeposited + event.params.assets) +
      shareholder.totalWithdrawn,
    lastActivityAt: BigInt(event.block.timestamp),
  };

  context.Shareholder.set(updatedShareholder);

  const vaultDeposit: VaultDeposit = {
    id: eventId,
    vault_id: vaultId,
    shareholder_id: shareholderId,
    depositor: event.params.by,
    receiver: event.params.owner,
    assetsDeposited: event.params.assets,
    sharesReceived: event.params.shares,
    sharePrice:
      event.params.shares > BigInt(0)
        ? event.params.assets / event.params.shares
        : BigInt(0),
    vaultTotalAssets: updatedVault.totalAssets,
    vaultTotalShares: updatedVault.totalShares,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.VaultDeposit.set(vaultDeposit);
});

LLPVault.DepositsPaused.handler(async ({ event, context }) => {
  const eventEntity: LLPVault_DepositsPaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    paused: event.params.paused,
  };

  context.LLPVault_DepositsPaused.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const updatedVault: Vault = {
      ...vault,
      depositsPaused: event.params.paused,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);
  }
});

LLPVault.FeeUpdated.handler(async ({ event, context }) => {
  const eventEntity: LLPVault_FeeUpdated = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    feeType: event.params.feeType,
    newRate: event.params.newRate,
  };

  context.LLPVault_FeeUpdated.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const updatedVault: Vault = {
      ...vault,
      depositFeeRate:
        event.params.feeType === "deposit"
          ? event.params.newRate
          : vault.depositFeeRate,
      withdrawalFeeRate:
        event.params.feeType === "withdrawal"
          ? event.params.newRate
          : vault.withdrawalFeeRate,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);
  }
});

LLPVault.FundingPaymentRecorded.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_FundingPaymentRecorded = {
    id: eventId,
    netFundingPnL: event.params.netFundingPnL,
    newTotalAssets: event.params.newTotalAssets,
  };

  context.LLPVault_FundingPaymentRecorded.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    let newTotalRevenue = vault.totalRevenue;
    let newFundingReceived = vault.fundingFeesReceived;
    let newFundingPaid = vault.fundingFeesPaid;
    let revenueType: "FUNDING_RECEIVED" | "FUNDING_PAID" | undefined =
      undefined;
    let revenueAmount = BigInt(0);

    if (event.params.netFundingPnL > BigInt(0)) {
      newFundingReceived =
        vault.fundingFeesReceived + event.params.netFundingPnL;
      newTotalRevenue = vault.totalRevenue + event.params.netFundingPnL;
      revenueType = "FUNDING_RECEIVED";
      revenueAmount = event.params.netFundingPnL;
    } else if (event.params.netFundingPnL < BigInt(0)) {
      const fundingPaid = BigInt(-event.params.netFundingPnL);
      newFundingPaid = vault.fundingFeesPaid + fundingPaid;
      revenueType = "FUNDING_PAID";
      revenueAmount = fundingPaid;
    }

    const newNetFunding = newFundingReceived - newFundingPaid;
    const newNetProfit = newTotalRevenue - vault.traderProfitsPaid;

    const updatedVault: Vault = {
      ...vault,
      totalAssets: event.params.newTotalAssets,
      sharePrice:
        vault.totalShares > BigInt(0)
          ? event.params.newTotalAssets / vault.totalShares
          : BigInt(0),
      fundingFeesReceived: newFundingReceived,
      fundingFeesPaid: newFundingPaid,
      netFundingFees: newNetFunding,
      totalRevenue: newTotalRevenue,
      netProfit: newNetProfit,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);

    if (revenueType) {
      const vaultRevenue: VaultRevenue = {
        id: eventId,
        vault_id: vaultId,
        revenueType: revenueType,
        amount: revenueAmount,
        vaultTotalAssets: event.params.newTotalAssets,
        vaultTotalShares: vault.totalShares,
        vaultSharePrice: updatedVault.sharePrice,
        isProfit: event.params.netFundingPnL > BigInt(0) ? true : false,
        timestamp: BigInt(event.block.timestamp),
        blockNumber: BigInt(event.block.number),
        transactionHash: event.transaction.hash,
      };

      context.VaultRevenue.set(vaultRevenue);
    }
  }
});

LLPVault.LiquidationFeePaid.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_LiquidationFeePaid = {
    id: eventId,
    amount: event.params.amount,
  };

  context.LLPVault_LiquidationFeePaid.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const newTotalAssets = vault.totalAssets + event.params.amount;
    const newTotalRevenue = vault.totalRevenue + event.params.amount;
    const newLiquidationFees =
      vault.liquidationFeesCollected + event.params.amount;
    const newNetProfit = newTotalRevenue - vault.traderProfitsPaid;

    const updatedVault: Vault = {
      ...vault,
      totalAssets: newTotalAssets,
      sharePrice:
        vault.totalShares > BigInt(0)
          ? newTotalAssets / vault.totalShares
          : BigInt(0),
      liquidationFeesCollected: newLiquidationFees,
      totalRevenue: newTotalRevenue,
      netProfit: newNetProfit,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);

    const vaultRevenue: VaultRevenue = {
      id: eventId,
      vault_id: vaultId,
      revenueType: "LIQUIDATION_FEE",
      amount: event.params.amount,
      vaultTotalAssets: newTotalAssets,
      vaultTotalShares: vault.totalShares,
      vaultSharePrice: updatedVault.sharePrice,
      isProfit: undefined,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    };

    context.VaultRevenue.set(vaultRevenue);
  }
});

LLPVault.TraderPnLSettled.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_TraderPnLSettled = {
    id: eventId,
    pnl: event.params.pnl,
    newTotalAssets: event.params.newTotalAssets,
  };

  context.LLPVault_TraderPnLSettled.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    let newTotalRevenue = vault.totalRevenue;
    let newTraderLosses = vault.traderLossesCollected;
    let newTraderProfits = vault.traderProfitsPaid;
    let revenueType: "TRADER_LOSS" | undefined = undefined;
    let revenueAmount = BigInt(0);

    if (event.params.pnl > BigInt(0)) {
      newTraderProfits = vault.traderProfitsPaid + event.params.pnl;
    } else if (event.params.pnl < BigInt(0)) {
      const traderLoss = BigInt(-event.params.pnl);
      newTraderLosses = vault.traderLossesCollected + traderLoss;
      newTotalRevenue = vault.totalRevenue + traderLoss;
      revenueType = "TRADER_LOSS";
      revenueAmount = traderLoss;
    }

    const newNetProfit = newTotalRevenue - newTraderProfits;

    const updatedVault: Vault = {
      ...vault,
      totalAssets: event.params.newTotalAssets,
      sharePrice:
        vault.totalShares > BigInt(0)
          ? event.params.newTotalAssets / vault.totalShares
          : BigInt(0),
      traderLossesCollected: newTraderLosses,
      traderProfitsPaid: newTraderProfits,
      totalRevenue: newTotalRevenue,
      netProfit: newNetProfit,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);

    if (revenueType && revenueAmount > BigInt(0)) {
      const vaultRevenue: VaultRevenue = {
        id: eventId,
        vault_id: vaultId,
        revenueType: revenueType,
        amount: revenueAmount,
        vaultTotalAssets: event.params.newTotalAssets,
        vaultTotalShares: vault.totalShares,
        vaultSharePrice: updatedVault.sharePrice,
        isProfit: false,
        timestamp: BigInt(event.block.timestamp),
        blockNumber: BigInt(event.block.number),
        transactionHash: event.transaction.hash,
      };

      context.VaultRevenue.set(vaultRevenue);
    }
  }
});

LLPVault.TradingFeePaid.handler(async ({ event, context }) => {
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_TradingFeePaid = {
    id: eventId,
    amount: event.params.amount,
  };

  context.LLPVault_TradingFeePaid.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const newTotalAssets = vault.totalAssets + event.params.amount;
    const newTotalRevenue = vault.totalRevenue + event.params.amount;
    const newTradingFees = vault.tradingFeesCollected + event.params.amount;
    const newNetProfit = newTotalRevenue - vault.traderProfitsPaid;

    const updatedVault: Vault = {
      ...vault,
      totalAssets: newTotalAssets,
      sharePrice:
        vault.totalShares > BigInt(0)
          ? newTotalAssets / vault.totalShares
          : BigInt(0),
      tradingFeesCollected: newTradingFees,
      totalRevenue: newTotalRevenue,
      netProfit: newNetProfit,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);

    const vaultRevenue: VaultRevenue = {
      id: eventId,
      vault_id: vaultId,
      revenueType: "TRADING_FEE",
      amount: event.params.amount,
      vaultTotalAssets: newTotalAssets,
      vaultTotalShares: vault.totalShares,
      vaultSharePrice: updatedVault.sharePrice,
      isProfit: undefined,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    };

    context.VaultRevenue.set(vaultRevenue);
  }
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
  const eventId = `${event.chainId}_${event.block.number}_${event.logIndex}`;
  const eventEntity: LLPVault_Withdraw = {
    id: eventId,
    by: event.params.by,
    to: event.params.to,
    owner: event.params.owner,
    assets: event.params.assets,
    shares: event.params.shares,
  };

  context.LLPVault_Withdraw.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const updatedVault: Vault = {
      ...vault,
      totalAssets: vault.totalAssets - event.params.assets,
      totalShares: vault.totalShares - event.params.shares,
      sharePrice:
        vault.totalShares - event.params.shares > BigInt(0)
          ? (vault.totalAssets - event.params.assets) /
            (vault.totalShares - event.params.shares)
          : BigInt(0),
      totalWithdrawalsAmount:
        vault.totalWithdrawalsAmount + event.params.assets,
      withdrawalCount: vault.withdrawalCount + BigInt(1),
      netDeposits: vault.netDeposits - event.params.assets,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);

    const shareholderId = `${event.chainId}_${event.params.owner}`;
    const shareholder = await context.Shareholder.get(shareholderId);

    if (shareholder) {
      const updatedShareholder: Shareholder = {
        ...shareholder,
        currentShares: shareholder.currentShares - event.params.shares,
        estimatedValue:
          (shareholder.currentShares - event.params.shares) *
          updatedVault.sharePrice,
        totalWithdrawn: shareholder.totalWithdrawn + event.params.assets,
        netDeposits: shareholder.netDeposits - event.params.assets,
        totalSharesBurned: shareholder.totalSharesBurned + event.params.shares,
        withdrawalCount: shareholder.withdrawalCount + BigInt(1),
        unrealizedPnL:
          (shareholder.currentShares - event.params.shares) *
            updatedVault.sharePrice -
          shareholder.totalDeposited +
          (shareholder.totalWithdrawn + event.params.assets),
        lastActivityAt: BigInt(event.block.timestamp),
      };

      context.Shareholder.set(updatedShareholder);
    }

    const vaultWithdrawal: VaultWithdrawal = {
      id: eventId,
      vault_id: vaultId,
      shareholder_id: shareholderId,
      withdrawer: event.params.by,
      receiver: event.params.to,
      owner: event.params.owner,
      assetsWithdrawn: event.params.assets,
      sharesBurned: event.params.shares,
      sharePrice:
        event.params.shares > BigInt(0)
          ? event.params.assets / event.params.shares
          : BigInt(0),
      vaultTotalAssets: updatedVault.totalAssets,
      vaultTotalShares: updatedVault.totalShares,
      timestamp: BigInt(event.block.timestamp),
      blockNumber: BigInt(event.block.number),
      transactionHash: event.transaction.hash,
    };

    context.VaultWithdrawal.set(vaultWithdrawal);
  }
});

LLPVault.WithdrawalsPaused.handler(async ({ event, context }) => {
  const eventEntity: LLPVault_WithdrawalsPaused = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    paused: event.params.paused,
  };

  context.LLPVault_WithdrawalsPaused.set(eventEntity);

  const vaultId = `${event.chainId}_vault`;
  const vault = await context.Vault.get(vaultId);

  if (vault) {
    const updatedVault: Vault = {
      ...vault,
      withdrawalsPaused: event.params.paused,
      lastUpdatedAt: BigInt(event.block.timestamp),
    };

    context.Vault.set(updatedVault);
  }
});
