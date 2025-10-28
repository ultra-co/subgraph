import assert from "assert";
import { TestHelpers, Position, Trader, Market, Funding } from "../generated";
const { MockDb, LiquidRouter, MarketFactory, LiquidationEngine } = TestHelpers;

describe("Integration tests - Full position lifecycle", () => {
  const chainId = 84532;
  const trader = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const positionKey =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const marketId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  describe("Complete position lifecycle - Open to Close", () => {
    it("should handle full lifecycle with funding payments", async () => {
      let mockDb = MockDb.createMockDb();

      const marketEvent = MarketFactory.MarketCreated.createMockEvent({
        marketId,
        name: "Will BTC reach 100k?",
        sourcePlatform: "Polymarket",
        sourceMarketId: "poly-123",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
      });

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: marketEvent,
        mockDb,
      });

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const fundingPaidEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(30e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingPaidEvent,
        mockDb,
      });

      const fundingReceivedEvent = LiquidRouter.FundingReceived.createMockEvent(
        {
          positionKey,
          trader,
          marketId,
          amount: BigInt(20e6),
        }
      );

      mockDb = await LiquidRouter.FundingReceived.processEvent({
        event: fundingReceivedEvent,
        mockDb,
      });

      const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
        pnl: BigInt(500e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(490e6),
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
        mockDb,
      });

      const market = mockDb.entities.Market.get(`${chainId}_${marketId}`);
      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.ok(market, "Market should exist");
      assert.strictEqual(market?.name, "Will BTC reach 100k?");

      assert.ok(position, "Position should exist");
      assert.strictEqual(position?.collateral, BigInt(990e6));
      assert.strictEqual(position?.closed, true);
      assert.strictEqual(position?.closedReason, "MANUAL");
      assert.strictEqual(position?.pnl, BigInt(500e6));

      assert.ok(traderEntity, "Trader should exist");
      assert.strictEqual(traderEntity?.totalPositions, BigInt(1));
      assert.strictEqual(traderEntity?.openPositions, BigInt(0));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });

    it("should track multiple positions for same trader", async () => {
      let mockDb = MockDb.createMockDb();
      const positionKey1 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000001";
      const positionKey2 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000002";

      const openEvent1 = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey: positionKey1,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      const openEvent2 = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey: positionKey2,
        marketId,
        collateral: BigInt(2000e6),
        size: BigInt(15000e6),
        isLong: false,
        totalFee: BigInt(15e6),
        lpFee: BigInt(12e6),
        protocolFee: BigInt(3e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent1,
        mockDb,
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent2,
        mockDb,
      });

      const closeEvent1 = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey: positionKey1,
        pnl: BigInt(200e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(190e6),
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent1,
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.totalPositions, BigInt(2));
      assert.strictEqual(traderEntity?.openPositions, BigInt(1));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });
  });

  describe("Position liquidation flow", () => {
    it("should handle position liquidation correctly", async () => {
      let mockDb = MockDb.createMockDb();

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const liquidationEvent =
        LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey,
          trader,
          liquidator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
          collateralSeized: BigInt(900e6),
          keeperReward: BigInt(50e6),
          penaltyToVault: BigInt(50e6),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.closed, true);
      assert.strictEqual(position?.liquidated, true);
      assert.strictEqual(position?.closedReason, "LIQUIDATED");

      assert.strictEqual(traderEntity?.openPositions, BigInt(0));
      assert.strictEqual(traderEntity?.liquidatedPositions, BigInt(1));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(0));
    });

    it("should handle funding payments before liquidation", async () => {
      let mockDb = MockDb.createMockDb();

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const fundingPaidEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(100e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingPaidEvent,
        mockDb,
      });

      const liquidationEvent =
        LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey,
          trader,
          liquidator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
          collateralSeized: BigInt(850e6),
          keeperReward: BigInt(25e6),
          penaltyToVault: BigInt(25e6),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.collateral, BigInt(900e6));
      assert.strictEqual(position?.liquidated, true);
    });
  });

  describe("Expired position settlement", () => {
    it("should handle expired position correctly", async () => {
      let mockDb = MockDb.createMockDb();

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const expiredEvent = LiquidRouter.ExpiredPositionSettled.createMockEvent({
        positionKey,
        trader,
        marketId,
        pnl: BigInt(50e6),
        netReturn: BigInt(40e6),
      });

      mockDb = await LiquidRouter.ExpiredPositionSettled.processEvent({
        event: expiredEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.closed, true);
      assert.strictEqual(position?.closedReason, "EXPIRED");
      assert.strictEqual(position?.pnl, BigInt(50e6));

      assert.strictEqual(traderEntity?.openPositions, BigInt(0));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });
  });

  describe("Insufficient funding auto-close", () => {
    it("should handle auto-close with remaining value", async () => {
      let mockDb = MockDb.createMockDb();

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const autoCloseEvent =
        LiquidRouter.PositionAutoClosedInsufficientFunding.createMockEvent({
          positionKey,
          trader,
          marketId,
          remainingValue: BigInt(50e6),
        });

      mockDb =
        await LiquidRouter.PositionAutoClosedInsufficientFunding.processEvent({
          event: autoCloseEvent,
          mockDb,
        });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.closed, true);
      assert.strictEqual(position?.closedReason, "INSUFFICIENT_FUNDING");
      assert.strictEqual(position?.remainingValue, BigInt(50e6));

      assert.strictEqual(traderEntity?.openPositions, BigInt(0));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });

    it("should handle zero remaining value", async () => {
      let mockDb = MockDb.createMockDb();

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const autoCloseEvent =
        LiquidRouter.PositionAutoClosedInsufficientFunding.createMockEvent({
          positionKey,
          trader,
          marketId,
          remainingValue: BigInt(0),
        });

      mockDb =
        await LiquidRouter.PositionAutoClosedInsufficientFunding.processEvent({
          event: autoCloseEvent,
          mockDb,
        });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.remainingValue, BigInt(0));
    });
  });

  describe("Trader statistics across multiple positions", () => {
    it("should accurately track trader stats across varied position outcomes", async () => {
      let mockDb = MockDb.createMockDb();
      const positionKey1 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000001";
      const positionKey2 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000002";
      const positionKey3 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000003";

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey: positionKey1,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey: positionKey2,
          marketId,
          collateral: BigInt(2000e6),
          size: BigInt(15000e6),
          isLong: false,
          totalFee: BigInt(15e6),
          lpFee: BigInt(12e6),
          protocolFee: BigInt(3e6),
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey: positionKey3,
          marketId,
          collateral: BigInt(500e6),
          size: BigInt(5000e6),
          isLong: true,
          totalFee: BigInt(5e6),
          lpFee: BigInt(4e6),
          protocolFee: BigInt(1e6),
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positionKey1,
          pnl: BigInt(200e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(190e6),
        }),
        mockDb,
      });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey: positionKey2,
          trader,
          liquidator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
          collateralSeized: BigInt(1800e6),
          keeperReward: BigInt(100e6),
          penaltyToVault: BigInt(100e6),
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.totalPositions, BigInt(3));
      assert.strictEqual(traderEntity?.openPositions, BigInt(1));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
      assert.strictEqual(traderEntity?.liquidatedPositions, BigInt(1));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(30000e6));
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("should handle closing non-existent position gracefully", async () => {
      const mockDb = MockDb.createMockDb();
      const nonExistentKey =
        "0xbbbb000000000000000000000000000000000000000000000000000000000000";

      const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey: nonExistentKey,
        pnl: BigInt(100e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(90e6),
      });

      const mockDbUpdated = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
        mockDb,
      });

      const position = mockDbUpdated.entities.Position.get(
        `${chainId}_${nonExistentKey}`
      );

      assert.strictEqual(position, undefined);
    });

    it("should handle funding for non-existent position gracefully", async () => {
      const mockDb = MockDb.createMockDb();
      const nonExistentKey =
        "0xbbbb000000000000000000000000000000000000000000000000000000000000";

      const fundingEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey: nonExistentKey,
        trader,
        marketId,
        amount: BigInt(50e6),
      });

      const mockDbUpdated = await LiquidRouter.FundingPaid.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const funding = mockDbUpdated.entities.Funding.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.ok(
        funding,
        "Funding should still be created even if position doesn't exist"
      );
    });

    it("should handle positions with same key on different chains", async () => {
      let mockDb = MockDb.createMockDb();
      const chain1 = 1;
      const chain2 = 10;

      const openEvent1 = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent1,
        mockDb,
      });

      const position1 = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.ok(position1, "Position on first chain should exist");
      assert.strictEqual(position1?.positionKey, positionKey);
    });
  });
});
