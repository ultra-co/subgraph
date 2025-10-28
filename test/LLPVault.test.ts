import assert from "assert";
import {
  TestHelpers,
  LLPVault_Deposit,
  LLPVault_Withdraw,
  LLPVault_Transfer,
} from "../generated";
const { MockDb, LLPVault } = TestHelpers;

describe("LLPVault contract tests", () => {
  const chainId = 84532;
  const user = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const owner = "0x842d35Cc6634C0532925a3b844Bc9e7595f0bEc";

  describe("Deposit event", () => {
    it("should create deposit entity correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.Deposit.createMockEvent({
        by: user,
        owner,
        assets: BigInt(1000e6),
        shares: BigInt(950e6),
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const actualDeposit = mockDbUpdated.entities.LLPVault_Deposit.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      const expectedDeposit: LLPVault_Deposit = {
        id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
        by: user,
        owner,
        assets: BigInt(1000e6),
        shares: BigInt(950e6),
      };

      assert.deepEqual(actualDeposit, expectedDeposit);
    });

    it("should handle zero asset deposit", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.Deposit.createMockEvent({
        by: user,
        owner,
        assets: BigInt(0),
        shares: BigInt(0),
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const actualDeposit = mockDbUpdated.entities.LLPVault_Deposit.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualDeposit?.assets, BigInt(0));
      assert.strictEqual(actualDeposit?.shares, BigInt(0));
    });

    it("should handle large deposit amounts", async () => {
      const mockDb = MockDb.createMockDb();
      const largeAmount = BigInt("1000000000000000");

      const event = LLPVault.Deposit.createMockEvent({
        by: user,
        owner,
        assets: largeAmount,
        shares: largeAmount,
      });

      const mockDbUpdated = await LLPVault.Deposit.processEvent({
        event,
        mockDb,
      });

      const actualDeposit = mockDbUpdated.entities.LLPVault_Deposit.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualDeposit?.assets, largeAmount);
    });
  });

  describe("Withdraw event", () => {
    it("should create withdraw entity correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const to = "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd";

      const event = LLPVault.Withdraw.createMockEvent({
        by: user,
        to,
        owner,
        assets: BigInt(500e6),
        shares: BigInt(475e6),
      });

      const mockDbUpdated = await LLPVault.Withdraw.processEvent({
        event,
        mockDb,
      });

      const actualWithdraw = mockDbUpdated.entities.LLPVault_Withdraw.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.ok(actualWithdraw, "Withdraw should exist");
      assert.strictEqual(actualWithdraw?.by, user);
      assert.strictEqual(actualWithdraw?.to, to);
      assert.strictEqual(actualWithdraw?.owner, owner);
      assert.strictEqual(actualWithdraw?.assets, BigInt(500e6));
      assert.strictEqual(actualWithdraw?.shares, BigInt(475e6));
    });

    it("should handle full withdrawal", async () => {
      const mockDb = MockDb.createMockDb();
      const to = "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd";

      const event = LLPVault.Withdraw.createMockEvent({
        by: user,
        to,
        owner,
        assets: BigInt(1000e6),
        shares: BigInt(1000e6),
      });

      const mockDbUpdated = await LLPVault.Withdraw.processEvent({
        event,
        mockDb,
      });

      const actualWithdraw = mockDbUpdated.entities.LLPVault_Withdraw.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.ok(actualWithdraw, "Full withdrawal should be recorded");
    });
  });

  describe("Transfer event", () => {
    it("should create transfer entity correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const from = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
      const to = "0x842d35Cc6634C0532925a3b844Bc9e7595f0bEc";

      const event = LLPVault.Transfer.createMockEvent({
        from,
        to,
        amount: BigInt(100e6),
      });

      const mockDbUpdated = await LLPVault.Transfer.processEvent({
        event,
        mockDb,
      });

      const actualTransfer = mockDbUpdated.entities.LLPVault_Transfer.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.ok(actualTransfer, "Transfer should exist");
      assert.strictEqual(actualTransfer?.from, from);
      assert.strictEqual(actualTransfer?.to, to);
      assert.strictEqual(actualTransfer?.amount, BigInt(100e6));
    });
  });

  describe("DepositsPaused event", () => {
    it("should record paused state correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.DepositsPaused.createMockEvent({
        paused: true,
      });

      const mockDbUpdated = await LLPVault.DepositsPaused.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_DepositsPaused.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.paused, true);
    });

    it("should record unpaused state correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.DepositsPaused.createMockEvent({
        paused: false,
      });

      const mockDbUpdated = await LLPVault.DepositsPaused.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_DepositsPaused.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.paused, false);
    });
  });

  describe("FeeUpdated event", () => {
    it("should record fee update correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.FeeUpdated.createMockEvent({
        feeType: "management",
        newRate: BigInt(200),
      });

      const mockDbUpdated = await LLPVault.FeeUpdated.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_FeeUpdated.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.feeType, "management");
      assert.strictEqual(actualEvent?.newRate, BigInt(200));
    });
  });

  describe("TradingFeePaid event", () => {
    it("should record trading fee correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.TradingFeePaid.createMockEvent({
        amount: BigInt(50e6),
      });

      const mockDbUpdated = await LLPVault.TradingFeePaid.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_TradingFeePaid.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.amount, BigInt(50e6));
    });
  });

  describe("TraderPnLSettled event", () => {
    it("should record positive PnL settlement", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.TraderPnLSettled.createMockEvent({
        pnl: BigInt(100e6),
        newTotalAssets: BigInt(10100e6),
      });

      const mockDbUpdated = await LLPVault.TraderPnLSettled.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_TraderPnLSettled.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.pnl, BigInt(100e6));
      assert.strictEqual(actualEvent?.newTotalAssets, BigInt(10100e6));
    });

    it("should record negative PnL settlement", async () => {
      const mockDb = MockDb.createMockDb();
      const event = LLPVault.TraderPnLSettled.createMockEvent({
        pnl: BigInt(-100e6),
        newTotalAssets: BigInt(9900e6),
      });

      const mockDbUpdated = await LLPVault.TraderPnLSettled.processEvent({
        event,
        mockDb,
      });

      const actualEvent = mockDbUpdated.entities.LLPVault_TraderPnLSettled.get(
        `${event.chainId}_${event.block.number}_${event.logIndex}`
      );

      assert.strictEqual(actualEvent?.pnl, BigInt(-100e6));
    });
  });
});
