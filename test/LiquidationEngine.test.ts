import assert from "assert";
import {
  TestHelpers,
  LiquidationEngine_PositionLiquidated,
  Position,
  Trader,
} from "../generated";
const { MockDb, LiquidationEngine, LiquidRouter } = TestHelpers;

describe("LiquidationEngine contract tests", () => {
  const chainId = 84532;
  const trader = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const liquidator = "0x842d35Cc6634C0532925a3b844Bc9e7595f0bEc";
  const positionKey =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const marketId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  describe("PositionLiquidated event", () => {
    it("should liquidate position and update trader stats", async () => {
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
          liquidator,
          collateralSeized: BigInt(900e6),
          keeperReward: BigInt(50e6),
          penaltyToVault: BigInt(50e6),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const actualTrader = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(actualPosition?.closed, true);
      assert.strictEqual(actualPosition?.liquidated, true);
      assert.strictEqual(actualPosition?.closedReason, "LIQUIDATED");
      assert.strictEqual(
        actualPosition?.liquidatedAt,
        BigInt(liquidationEvent.block.timestamp)
      );

      assert.strictEqual(actualTrader?.openPositions, BigInt(0));
      assert.strictEqual(actualTrader?.liquidatedPositions, BigInt(1));
      assert.strictEqual(actualTrader?.closedPositions, BigInt(0));
    });

    it("should handle multiple liquidations for same trader", async () => {
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

      const liquidationEvent1 =
        LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey: positionKey1,
          trader,
          liquidator,
          collateralSeized: BigInt(900e6),
          keeperReward: BigInt(50e6),
          penaltyToVault: BigInt(50e6),
        });

      const liquidationEvent2 =
        LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey: positionKey2,
          trader,
          liquidator,
          collateralSeized: BigInt(1800e6),
          keeperReward: BigInt(100e6),
          penaltyToVault: BigInt(100e6),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent1,
        mockDb,
      });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent2,
        mockDb,
      });

      const actualTrader = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(actualTrader?.openPositions, BigInt(0));
      assert.strictEqual(actualTrader?.liquidatedPositions, BigInt(2));
      assert.strictEqual(actualTrader?.totalPositions, BigInt(2));
    });

    it("should store liquidation details correctly", async () => {
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
          liquidator,
          collateralSeized: BigInt(900e6),
          keeperReward: BigInt(50e6),
          penaltyToVault: BigInt(50e6),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const actualEvent =
        mockDb.entities.LiquidationEngine_PositionLiquidated.get(
          `${chainId}_${liquidationEvent.block.number}_${liquidationEvent.logIndex}`
        );

      assert.ok(actualEvent, "Liquidation event should exist");
      assert.strictEqual(actualEvent?.collateralSeized, BigInt(900e6));
      assert.strictEqual(actualEvent?.keeperReward, BigInt(50e6));
      assert.strictEqual(actualEvent?.penaltyToVault, BigInt(50e6));
      assert.strictEqual(actualEvent?.liquidator, liquidator);
    });

    it("should handle zero collateral seized", async () => {
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
          liquidator,
          collateralSeized: BigInt(0),
          keeperReward: BigInt(0),
          penaltyToVault: BigInt(0),
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(actualPosition?.closed, true);
      assert.strictEqual(actualPosition?.liquidated, true);
    });
  });

  describe("KeeperRewardsClaimed event", () => {
    it("should create keeper rewards entity correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const keeper = "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd";

      const event = LiquidationEngine.KeeperRewardsClaimed.createMockEvent({
        keeper,
        amount: BigInt(100e6),
      });

      const mockDbUpdated =
        await LiquidationEngine.KeeperRewardsClaimed.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.LiquidationEngine_KeeperRewardsClaimed.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      assert.ok(actualEvent, "Keeper rewards event should exist");
      assert.strictEqual(actualEvent?.keeper, keeper);
      assert.strictEqual(actualEvent?.amount, BigInt(100e6));
    });
  });

  describe("ParametersUpdated event", () => {
    it("should create parameters updated entity correctly", async () => {
      const mockDb = MockDb.createMockDb();

      const event = LiquidationEngine.ParametersUpdated.createMockEvent({
        maintenanceMarginRate: BigInt(500),
        liquidationPenaltyRate: BigInt(50),
        keeperFee: BigInt(25),
      });

      const mockDbUpdated =
        await LiquidationEngine.ParametersUpdated.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.LiquidationEngine_ParametersUpdated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      assert.ok(actualEvent, "Parameters updated event should exist");
      assert.strictEqual(actualEvent?.maintenanceMarginRate, BigInt(500));
      assert.strictEqual(actualEvent?.liquidationPenaltyRate, BigInt(50));
      assert.strictEqual(actualEvent?.keeperFee, BigInt(25));
    });
  });
});
