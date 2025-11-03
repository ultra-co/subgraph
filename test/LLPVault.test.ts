import assert from "assert";
import {
  TestHelpers,
  LLPVault_Deposit,
  LLPVault_Withdraw,
  LLPVault_Transfer,
  LLPVault_TradingFeePaid,
  LLPVault_LiquidationFeePaid,
  LLPVault_TraderPnLSettled,
  LLPVault_FundingPaymentRecorded,
  Vault,
  Shareholder,
  VaultDeposit,
  VaultWithdrawal,
  VaultRevenue,
} from "../generated";
const { MockDb, LLPVault } = TestHelpers;

describe("LLPVault contract tests", () => {
  const chainId = 84532;
  const vaultAddress = "0xBCF9CEAA41165AfCD485C9dA224a9b99BA9a183b";
  const vaultId = `${chainId}_${vaultAddress.toLowerCase()}`;
  const alice = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const bob = "0x842d35Cc6634C0532925a3b844Bc9e7595f0bEc";

  describe("Deposit event - Vault creation and updates", () => {
    it("should create vault on first deposit", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const vault = mockDbUpdated.entities.Vault.get(vaultId);

      assert.ok(vault, "Vault should be created");
      assert.strictEqual(vault?.totalAssets, BigInt(10000e6));
      assert.strictEqual(vault?.totalShares, BigInt(10000e6));
      assert.strictEqual(vault?.sharePrice, BigInt(1e18));
      assert.strictEqual(vault?.totalDepositsAmount, BigInt(10000e6));
      assert.strictEqual(vault?.depositCount, BigInt(1));
    });

    it("should create shareholder on first deposit", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const shareholder = mockDbUpdated.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      assert.ok(shareholder, "Shareholder should be created");
      assert.strictEqual(shareholder?.currentShares, BigInt(10000e6));
      assert.strictEqual(shareholder?.totalDeposited, BigInt(10000e6));
      assert.strictEqual(shareholder?.averageDepositPrice, BigInt(1e18));
      assert.strictEqual(shareholder?.unrealizedPnL, BigInt(0));
    });

    it("should create VaultDeposit record", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const deposit = mockDbUpdated.entities.VaultDeposit.get(
        `${chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.ok(deposit, "VaultDeposit should be created");
      assert.strictEqual(deposit?.assetsDeposited, BigInt(10000e6));
      assert.strictEqual(deposit?.sharesReceived, BigInt(10000e6));
      assert.strictEqual(deposit?.sharePrice, BigInt(1e18));
      assert.strictEqual(deposit?.vaultTotalAssets, BigInt(10000e6));
    });

    it("should handle second deposit with different share price", async () => {
      let mockDb = MockDb.createMockDb();

      const event1 = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          block: { number: 1000 },
          srcAddress: vaultAddress,
        },
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: event1,
        mockDb,
      });

      const tradingFee = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(1000e6),
        mockEventData: {
          block: { number: 1001 },
          srcAddress: vaultAddress,
        },
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: tradingFee,
        mockDb,
      });

      const event2 = LLPVault.Deposit.createMockEvent({
        by: bob,
        owner: bob,
        assets: BigInt(11000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          block: { number: 1002 },
          srcAddress: vaultAddress,
        },
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: event2,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const bobShareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${bob}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(22000e6));
      assert.strictEqual(vault?.totalShares, BigInt(20000e6));
      assert.strictEqual(vault?.sharePrice, BigInt(1.1e18));
      assert.strictEqual(bobShareholder?.averageDepositPrice, BigInt(1.1e18));
    });

    it("should handle depositor different from owner", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: bob,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const shareholder = mockDbUpdated.entities.Shareholder.get(
        `${chainId}_${bob}`
      );
      const deposit = mockDbUpdated.entities.VaultDeposit.get(
        `${chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(shareholder?.address, bob);
      assert.strictEqual(deposit?.depositor, alice);
      assert.strictEqual(deposit?.receiver, bob);
    });
  });

  describe("Withdraw event - Share redemption", () => {
    it("should decrease vault assets and shares", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const withdrawEvent = LLPVault.Withdraw.createMockEvent({
        by: alice,
        to: alice,
        owner: alice,
        assets: BigInt(5000e6),
        shares: BigInt(5000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      mockDb = await LLPVault.Withdraw.processEvent({
        event: withdrawEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, BigInt(5000e6));
      assert.strictEqual(vault?.totalShares, BigInt(5000e6));
      assert.strictEqual(vault?.totalWithdrawalsAmount, BigInt(5000e6));
      assert.strictEqual(vault?.withdrawalCount, BigInt(1));
    });

    it("should update shareholder on withdrawal", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Withdraw.processEvent({
        event: LLPVault.Withdraw.createMockEvent({
          by: alice,
          to: alice,
          owner: alice,
          assets: BigInt(5000e6),
          shares: BigInt(5000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const shareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      assert.strictEqual(shareholder?.currentShares, BigInt(5000e6));
      assert.strictEqual(shareholder?.totalWithdrawn, BigInt(5000e6));
      assert.strictEqual(shareholder?.withdrawalCount, BigInt(1));
      assert.strictEqual(shareholder?.unrealizedPnL, BigInt(0));
    });

    it("should create VaultWithdrawal record", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const withdrawEvent = LLPVault.Withdraw.createMockEvent({
        by: alice,
        to: alice,
        owner: alice,
        assets: BigInt(5000e6),
        shares: BigInt(5000e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.Withdraw.processEvent({
        event: withdrawEvent,
        mockDb,
      });

      const withdrawal = mockDb.entities.VaultWithdrawal.get(
        `${chainId}_${withdrawEvent.block.number}_${withdrawEvent.logIndex}`
      );

      assert.ok(withdrawal, "VaultWithdrawal should be created");
      assert.strictEqual(withdrawal?.assetsWithdrawn, BigInt(5000e6));
      assert.strictEqual(withdrawal?.sharesBurned, BigInt(5000e6));
      assert.strictEqual(withdrawal?.vaultTotalAssets, BigInt(5000e6));
    });

    it("should handle withdrawal with profit (share price increased)", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(1000e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Withdraw.processEvent({
        event: LLPVault.Withdraw.createMockEvent({
          by: alice,
          to: alice,
          owner: alice,
          assets: BigInt(5500e6),
          shares: BigInt(5000e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const shareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );
      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, BigInt(5500e6));
      assert.strictEqual(vault?.totalShares, BigInt(5000e6));
      assert.strictEqual(vault?.sharePrice, BigInt(1.1e18));
      assert.strictEqual(shareholder?.currentShares, BigInt(5000e6));
      assert.strictEqual(shareholder?.estimatedValue, BigInt(5500e6));
      assert.strictEqual(shareholder?.unrealizedPnL, BigInt(1000e6));
    });
  });

  describe("TradingFeePaid event - Revenue tracking", () => {
    it("should increase vault assets and create revenue record", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const feeEvent = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(100e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: feeEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const revenue = mockDb.entities.VaultRevenue.get(
        `${chainId}_${feeEvent.block.number}_${feeEvent.logIndex}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(10100e6));
      assert.strictEqual(vault?.tradingFeesCollected, BigInt(100e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(100e6));
      assert.strictEqual(vault?.netProfit, BigInt(100e6));

      assert.ok(revenue, "VaultRevenue should be created");
      assert.strictEqual(revenue?.revenueType, "TRADING_FEE");
      assert.strictEqual(revenue?.amount, BigInt(100e6));
      assert.strictEqual(revenue?.vaultTotalAssets, BigInt(10100e6));
    });

    it("should increase share price proportionally", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(1000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.sharePrice, BigInt(1.1e18));
    });
  });

  describe("LiquidationFeePaid event - Revenue tracking", () => {
    it("should track liquidation fees separately", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const feeEvent = LLPVault.LiquidationFeePaid.createMockEvent({
        amount: BigInt(50e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.LiquidationFeePaid.processEvent({
        event: feeEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const revenue = mockDb.entities.VaultRevenue.get(
        `${chainId}_${feeEvent.block.number}_${feeEvent.logIndex}`
      );

      assert.strictEqual(vault?.liquidationFeesCollected, BigInt(50e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(50e6));
      assert.strictEqual(revenue?.revenueType, "LIQUIDATION_FEE");
    });
  });

  describe("TraderPnLSettled event - PnL tracking", () => {
    it("should handle trader loss (vault profit)", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const pnlEvent = LLPVault.TraderPnLSettled.createMockEvent({
        pnl: BigInt(-500e6),
        newTotalAssets: BigInt(10500e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: pnlEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const revenue = mockDb.entities.VaultRevenue.get(
        `${chainId}_${pnlEvent.block.number}_${pnlEvent.logIndex}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(10500e6));
      assert.strictEqual(vault?.traderLossesCollected, BigInt(500e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(500e6));
      assert.strictEqual(vault?.traderProfitsPaid, BigInt(0));

      assert.ok(revenue, "Revenue should be created for trader loss");
      assert.strictEqual(revenue?.revenueType, "TRADER_LOSS");
      assert.strictEqual(revenue?.amount, BigInt(500e6));
      assert.strictEqual(revenue?.isProfit, false);
    });

    it("should handle trader profit (vault loss)", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const pnlEvent = LLPVault.TraderPnLSettled.createMockEvent({
        pnl: BigInt(500e6),
        newTotalAssets: BigInt(9500e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: pnlEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, BigInt(9500e6));
      assert.strictEqual(vault?.traderProfitsPaid, BigInt(500e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(0));
      assert.strictEqual(vault?.netProfit, BigInt(-500e6));
    });

    it("should handle zero PnL", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(0),
          newTotalAssets: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, BigInt(10000e6));
      assert.strictEqual(vault?.traderLossesCollected, BigInt(0));
      assert.strictEqual(vault?.traderProfitsPaid, BigInt(0));
    });
  });

  describe("FundingPaymentRecorded event - Funding flow", () => {
    it("should handle positive funding (vault receives)", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const fundingEvent = LLPVault.FundingPaymentRecorded.createMockEvent({
        netFundingPnL: BigInt(200e6),
        newTotalAssets: BigInt(10200e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.FundingPaymentRecorded.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const revenue = mockDb.entities.VaultRevenue.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(10200e6));
      assert.strictEqual(vault?.fundingFeesReceived, BigInt(200e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(200e6));
      assert.strictEqual(revenue?.revenueType, "FUNDING_RECEIVED");
      assert.strictEqual(revenue?.isProfit, true);
    });

    it("should handle negative funding (vault pays)", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const fundingEvent = LLPVault.FundingPaymentRecorded.createMockEvent({
        netFundingPnL: BigInt(-100e6),
        newTotalAssets: BigInt(9900e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.FundingPaymentRecorded.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const revenue = mockDb.entities.VaultRevenue.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(9900e6));
      assert.strictEqual(vault?.fundingFeesPaid, BigInt(100e6));
      assert.strictEqual(vault?.netFundingFees, BigInt(-100e6));
      assert.strictEqual(revenue?.revenueType, "FUNDING_PAID");
      assert.strictEqual(revenue?.isProfit, false);
    });
  });

  describe("Share price calculations", () => {
    it("should calculate share price correctly after fee collection", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(500e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, BigInt(10500e6));
      assert.strictEqual(vault?.totalShares, BigInt(10000e6));
      assert.strictEqual(vault?.sharePrice, BigInt(1.05e18));
    });

    it("should handle zero shares gracefully", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(100e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.TradingFeePaid.processEvent({
        event,
        mockDb,
      });

      const vault = mockDbUpdated.entities.Vault.get(vaultId);

      if (vault) {
        assert.strictEqual(vault.sharePrice, BigInt(0));
      }
    });
  });

  describe("Shareholder profit calculations", () => {
    it("should calculate unrealized PnL correctly with profit", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(1000e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const shareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      const currentEstimatedValue =
        ((shareholder?.currentShares || BigInt(0)) *
          (vault?.sharePrice || BigInt(0))) /
        BigInt(1e18);
      const unrealizedPnL =
        currentEstimatedValue -
        (shareholder?.totalDeposited || BigInt(0)) +
        (shareholder?.totalWithdrawn || BigInt(0));

      assert.strictEqual(currentEstimatedValue, BigInt(11000e6));
      assert.strictEqual(unrealizedPnL, BigInt(1000e6));
    });

    it("should calculate unrealized PnL with withdrawals", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(1000e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Withdraw.processEvent({
        event: LLPVault.Withdraw.createMockEvent({
          by: alice,
          to: alice,
          owner: alice,
          assets: BigInt(5500e6),
          shares: BigInt(5000e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const shareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      assert.strictEqual(shareholder?.currentShares, BigInt(5000e6));
      assert.strictEqual(shareholder?.totalWithdrawn, BigInt(5500e6));
      assert.strictEqual(shareholder?.unrealizedPnL, BigInt(1000e6));
    });

    it("should calculate average deposit price correctly", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(1000e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(11000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const shareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      assert.strictEqual(shareholder?.totalDeposited, BigInt(21000e6));
      assert.strictEqual(shareholder?.totalSharesReceived, BigInt(20000e6));
      assert.strictEqual(shareholder?.averageDepositPrice, BigInt(1.05e18));
    });
  });

  describe("Multiple shareholders - Profit sharing", () => {
    it("should distribute profits proportionally to share ownership", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: bob,
          owner: bob,
          assets: BigInt(90000e6),
          shares: BigInt(90000e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(5000e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const aliceShareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );
      const bobShareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${bob}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(105000e6));
      assert.strictEqual(vault?.sharePrice, BigInt(1.05e18));

      const aliceEstimatedValue =
        ((aliceShareholder?.currentShares || BigInt(0)) *
          (vault?.sharePrice || BigInt(0))) /
        BigInt(1e18);
      const bobEstimatedValue =
        ((bobShareholder?.currentShares || BigInt(0)) *
          (vault?.sharePrice || BigInt(0))) /
        BigInt(1e18);

      const aliceProfit =
        aliceEstimatedValue - (aliceShareholder?.totalDeposited || BigInt(0));
      const bobProfit =
        bobEstimatedValue - (bobShareholder?.totalDeposited || BigInt(0));

      assert.strictEqual(aliceProfit, BigInt(500e6));
      assert.strictEqual(bobProfit, BigInt(4500e6));
      assert.strictEqual(aliceProfit + bobProfit, BigInt(5000e6));
    });
  });

  describe("Revenue type tracking", () => {
    it("should track all revenue types separately", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(100e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.LiquidationFeePaid.processEvent({
        event: LLPVault.LiquidationFeePaid.createMockEvent({
          amount: BigInt(50e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(-200e6),
          newTotalAssets: BigInt(10350e6),
          mockEventData: { block: { number: 1003 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.FundingPaymentRecorded.processEvent({
        event: LLPVault.FundingPaymentRecorded.createMockEvent({
          netFundingPnL: BigInt(30e6),
          newTotalAssets: BigInt(10380e6),
          mockEventData: { block: { number: 1004 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.tradingFeesCollected, BigInt(100e6));
      assert.strictEqual(vault?.liquidationFeesCollected, BigInt(50e6));
      assert.strictEqual(vault?.traderLossesCollected, BigInt(200e6));
      assert.strictEqual(vault?.fundingFeesReceived, BigInt(30e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(380e6));
    });
  });

  describe("Edge cases", () => {
    it("should handle zero asset deposit", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(0),
        shares: BigInt(0),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const vault = mockDbUpdated.entities.Vault.get(vaultId);

      assert.ok(vault, "Vault should be created even with zero deposit");
      assert.strictEqual(vault?.sharePrice, BigInt(0));
    });

    it("should handle very large deposits", async () => {
      const mockDb = MockDb.createMockDb();
      const largeAmount = BigInt("1000000000000000");

      const event = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: largeAmount,
        shares: largeAmount,
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const vault = mockDbUpdated.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalAssets, largeAmount);
    });

    it("should handle withdrawal without prior deposit gracefully", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Withdraw.createMockEvent({
        by: alice,
        to: alice,
        owner: alice,
        assets: BigInt(1000e6),
        shares: BigInt(1000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Withdraw.processEvent({
        event,
        mockDb,
      });

      const shareholder = mockDbUpdated.entities.Shareholder.get(
        `${chainId}_${alice}`
      );

      assert.strictEqual(shareholder, undefined);
    });

    it("should handle fee events before any deposits", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(100e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.TradingFeePaid.processEvent({
        event,
        mockDb,
      });

      const vault = mockDbUpdated.entities.Vault.get(vaultId);

      assert.strictEqual(vault, undefined);
    });
  });

  describe("Fee rate updates", () => {
    it("should update deposit fee rate", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.FeeUpdated.processEvent({
        event: LLPVault.FeeUpdated.createMockEvent({
          feeType: "deposit",
          newRate: BigInt(50),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.depositFeeRate, BigInt(50));
      assert.strictEqual(vault?.withdrawalFeeRate, BigInt(0));
    });

    it("should update withdrawal fee rate", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.FeeUpdated.processEvent({
        event: LLPVault.FeeUpdated.createMockEvent({
          feeType: "withdrawal",
          newRate: BigInt(25),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.depositFeeRate, BigInt(0));
      assert.strictEqual(vault?.withdrawalFeeRate, BigInt(25));
    });
  });

  describe("Pause state management", () => {
    it("should update deposits paused state", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.DepositsPaused.processEvent({
        event: LLPVault.DepositsPaused.createMockEvent({
          paused: true,
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.depositsPaused, true);
    });

    it("should update withdrawals paused state", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.WithdrawalsPaused.processEvent({
        event: LLPVault.WithdrawalsPaused.createMockEvent({
          paused: true,
          mockEventData: {
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.withdrawalsPaused, true);
    });
  });

  describe("Transfer event", () => {
    it("should only create raw event entity", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LLPVault.Transfer.createMockEvent({
        from: alice,
        to: bob,
        amount: BigInt(1000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      const mockDbUpdated = await LLPVault.Transfer.processEvent({
        event,
        mockDb,
      });

      const transfer = mockDbUpdated.entities.LLPVault_Transfer.get(
        `${chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.ok(transfer, "Transfer event should be recorded");
      assert.strictEqual(transfer?.from, alice);
      assert.strictEqual(transfer?.to, bob);
    });
  });

  describe("Net profit calculations", () => {
    it("should calculate net profit correctly", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(100e6),
          mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(-200e6),
          newTotalAssets: BigInt(10300e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(50e6),
          newTotalAssets: BigInt(10250e6),
          mockEventData: { block: { number: 1003 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);

      assert.strictEqual(vault?.totalRevenue, BigInt(300e6));
      assert.strictEqual(vault?.traderProfitsPaid, BigInt(50e6));
      assert.strictEqual(vault?.netProfit, BigInt(250e6));
    });
  });

  describe("Comprehensive lifecycle test", () => {
    it("should handle complete vault lifecycle with multiple shareholders", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(100000e6),
          shares: BigInt(100000e6),
          mockEventData: {
            block: { number: 1000, timestamp: 1000000 },
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: bob,
          owner: bob,
          assets: BigInt(900000e6),
          shares: BigInt(900000e6),
          mockEventData: {
            block: { number: 1001, timestamp: 1000100 },
            srcAddress: vaultAddress,
          },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(10000e6),
          mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.LiquidationFeePaid.processEvent({
        event: LLPVault.LiquidationFeePaid.createMockEvent({
          amount: BigInt(5000e6),
          mockEventData: { block: { number: 1003 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(-20000e6),
          newTotalAssets: BigInt(1035000e6),
          mockEventData: { block: { number: 1004 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.FundingPaymentRecorded.processEvent({
        event: LLPVault.FundingPaymentRecorded.createMockEvent({
          netFundingPnL: BigInt(3000e6),
          newTotalAssets: BigInt(1038000e6),
          mockEventData: { block: { number: 1005 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      mockDb = await LLPVault.TraderPnLSettled.processEvent({
        event: LLPVault.TraderPnLSettled.createMockEvent({
          pnl: BigInt(8000e6),
          newTotalAssets: BigInt(1030000e6),
          mockEventData: { block: { number: 1006 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const vault = mockDb.entities.Vault.get(vaultId);
      const aliceShareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${alice}`
      );
      const bobShareholder = mockDb.entities.Shareholder.get(
        `${chainId}_${bob}`
      );

      assert.strictEqual(vault?.totalAssets, BigInt(1030000e6));
      assert.strictEqual(vault?.totalShares, BigInt(1000000e6));
      assert.strictEqual(vault?.totalRevenue, BigInt(38000e6));
      assert.strictEqual(vault?.traderProfitsPaid, BigInt(8000e6));
      assert.strictEqual(vault?.netProfit, BigInt(30000e6));

      const aliceEstimatedValue =
        ((aliceShareholder?.currentShares || BigInt(0)) *
          (vault?.sharePrice || BigInt(0))) /
        BigInt(1e18);
      const bobEstimatedValue =
        ((bobShareholder?.currentShares || BigInt(0)) *
          (vault?.sharePrice || BigInt(0))) /
        BigInt(1e18);

      const aliceProfit =
        aliceEstimatedValue - (aliceShareholder?.totalDeposited || BigInt(0));
      const bobProfit =
        bobEstimatedValue - (bobShareholder?.totalDeposited || BigInt(0));

      assert.strictEqual(aliceProfit, BigInt(3000e6));
      assert.strictEqual(bobProfit, BigInt(27000e6));
      assert.strictEqual(aliceProfit + bobProfit, BigInt(30000e6));
    });
  });

  describe("Separate vaults per contract address", () => {
    const newVaultAddress = "0x1234567890123456789012345678901234567890";
    const newVaultId = `${chainId}_${newVaultAddress.toLowerCase()}`;

    it("should create separate vault entities for different contract addresses", async () => {
      let mockDb = MockDb.createMockDb();

      // Deposit to first vault
      const deposit1 = LLPVault.Deposit.createMockEvent({
        by: alice,
        owner: alice,
        assets: BigInt(10000e6),
        shares: BigInt(10000e6),
        mockEventData: {
          srcAddress: vaultAddress,
        },
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: deposit1,
        mockDb,
      });

      // Deposit to second vault (different address)
      const deposit2 = LLPVault.Deposit.createMockEvent({
        by: bob,
        owner: bob,
        assets: BigInt(5000e6),
        shares: BigInt(5000e6),
        mockEventData: {
          srcAddress: newVaultAddress,
        },
      });

      mockDb = await LLPVault.Deposit.processEvent({
        event: deposit2,
        mockDb,
      });

      const vault1 = mockDb.entities.Vault.get(vaultId);
      const vault2 = mockDb.entities.Vault.get(newVaultId);

      assert.ok(vault1, "First vault should be created");
      assert.ok(vault2, "Second vault should be created");
      assert.strictEqual(
        vault1?.address.toLowerCase(),
        vaultAddress.toLowerCase(),
        "First vault should have correct address"
      );
      assert.strictEqual(
        vault2?.address.toLowerCase(),
        newVaultAddress.toLowerCase(),
        "Second vault should have correct address"
      );
      assert.strictEqual(
        vault1?.totalAssets,
        BigInt(10000e6),
        "First vault should have its own assets"
      );
      assert.strictEqual(
        vault2?.totalAssets,
        BigInt(5000e6),
        "Second vault should have its own assets"
      );
    });

    it("should create new vault when contract address changes after initial deployment", async () => {
      let mockDb = MockDb.createMockDb();

      // Initial deployment - create vault with first address
      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: {
            srcAddress: vaultAddress,
            block: { number: 1000 },
          },
        }),
        mockDb,
      });

      // Add some fees to first vault
      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: LLPVault.TradingFeePaid.createMockEvent({
          amount: BigInt(500e6),
          mockEventData: {
            srcAddress: vaultAddress,
            block: { number: 1001 },
          },
        }),
        mockDb,
      });

      const oldVault = mockDb.entities.Vault.get(vaultId);
      assert.ok(oldVault, "Old vault should exist");
      assert.strictEqual(oldVault?.totalAssets, BigInt(10500e6));
      assert.strictEqual(oldVault?.tradingFeesCollected, BigInt(500e6));

      // New deployment - create vault with new address
      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: bob,
          owner: bob,
          assets: BigInt(20000e6),
          shares: BigInt(20000e6),
          mockEventData: {
            srcAddress: newVaultAddress,
            block: { number: 2000 },
          },
        }),
        mockDb,
      });

      // Verify old vault unchanged
      const oldVaultAfterNew = mockDb.entities.Vault.get(vaultId);
      assert.ok(oldVaultAfterNew, "Old vault should still exist");
      assert.strictEqual(
        oldVaultAfterNew?.totalAssets,
        BigInt(10500e6),
        "Old vault assets should be unchanged"
      );
      assert.strictEqual(
        oldVaultAfterNew?.totalShares,
        BigInt(10000e6),
        "Old vault shares should be unchanged"
      );

      // Verify new vault created
      const newVault = mockDb.entities.Vault.get(newVaultId);
      assert.ok(newVault, "New vault should be created");
      assert.strictEqual(
        newVault?.address.toLowerCase(),
        newVaultAddress.toLowerCase(),
        "New vault should have new address"
      );
      assert.strictEqual(
        newVault?.totalAssets,
        BigInt(20000e6),
        "New vault should have its own assets"
      );
      assert.strictEqual(
        newVault?.totalShares,
        BigInt(20000e6),
        "New vault should have its own shares"
      );
      assert.strictEqual(
        newVault?.tradingFeesCollected,
        BigInt(0),
        "New vault should start with zero fees"
      );

      // Verify both vaults are independent
      assert.notStrictEqual(
        vaultId,
        newVaultId,
        "Vault IDs should be different"
      );
      assert.strictEqual(
        oldVaultAfterNew?.totalAssets + newVault?.totalAssets,
        BigInt(30500e6),
        "Total assets should be sum of both vaults"
      );
    });
  });

  describe("Vault state snapshots in revenue events", () => {
    it("should capture vault state after each revenue event", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await LLPVault.Deposit.processEvent({
        event: LLPVault.Deposit.createMockEvent({
          by: alice,
          owner: alice,
          assets: BigInt(10000e6),
          shares: BigInt(10000e6),
          mockEventData: { block: { number: 1000 }, srcAddress: vaultAddress },
        }),
        mockDb,
      });

      const fee1 = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(100e6),
        mockEventData: { block: { number: 1001 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: fee1,
        mockDb,
      });

      const fee2 = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(200e6),
        mockEventData: { block: { number: 1002 }, srcAddress: vaultAddress },
      });

      mockDb = await LLPVault.TradingFeePaid.processEvent({
        event: fee2,
        mockDb,
      });

      const revenue1 = mockDb.entities.VaultRevenue.get(
        `${chainId}_${fee1.block.number}_${fee1.logIndex}`
      );
      const revenue2 = mockDb.entities.VaultRevenue.get(
        `${chainId}_${fee2.block.number}_${fee2.logIndex}`
      );

      assert.strictEqual(revenue1?.vaultTotalAssets, BigInt(10100e6));
      assert.strictEqual(revenue2?.vaultTotalAssets, BigInt(10300e6));
      assert.ok(
        (revenue2?.vaultSharePrice || BigInt(0)) >
          (revenue1?.vaultSharePrice || BigInt(0)),
        "Share price should increase with fees"
      );
    });
  });
});
