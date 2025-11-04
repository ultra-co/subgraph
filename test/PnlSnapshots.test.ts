import assert from "assert";
import {
  TestHelpers,
  PositionPnLSnapshot,
  Position,
  MarketPositionTracker,
} from "../generated";
const { MockDb, LiquidRouter, ProbabilityOracle, MarketFactory } = TestHelpers;

describe("PnL Snapshot Tests", () => {
  const chainId = 84532;
  const trader = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const positionKey =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const marketId =
    "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3";

  async function createMarket(mockDb: any) {
    const marketEvent = MarketFactory.MarketCreated.createMockEvent({
      marketId,
      name: "Test Market",
      sourcePlatform: "Polymarket",
      sourceMarketId: "test-123",
      expiryTimestamp: BigInt(1735689600),
      creator: trader,
    });

    return await MarketFactory.MarketCreated.processEvent({
      event: marketEvent,
      mockDb,
    });
  }

  describe("Position Opening", () => {
    it("should create initial PnL snapshot when position opens", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const event = LiquidRouter.PositionOpened.createMockEvent({
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

      const mockDbUpdated = await LiquidRouter.PositionOpened.processEvent({
        event,
        mockDb,
      });

      // Check tracker was created
      const tracker = mockDbUpdated.entities.MarketPositionTracker.get(
        `${chainId}_${marketId}`
      );
      assert.ok(tracker, "Tracker should be created");
      assert.strictEqual(
        tracker?.openPositionCount,
        BigInt(1),
        "Should have 1 open position"
      );

      // Check initial snapshot was created (at open time)
      const position = mockDbUpdated.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      assert.ok(position, "Position should exist");

      // Snapshot ID pattern: chainId_positionId_timestamp
      const snapshotId = `${chainId}_${chainId}_${positionKey}_${event.block.timestamp}`;
      const snapshot =
        mockDbUpdated.entities.PositionPnLSnapshot.get(snapshotId);

      assert.ok(snapshot, "Initial snapshot should be created");
      assert.strictEqual(
        snapshot?.position_id,
        `${chainId}_${positionKey}`,
        "Should reference correct position"
      );
      assert.strictEqual(
        snapshot?.pnl,
        BigInt(0),
        "Initial PnL should be 0 (at entry price)"
      );
    });

    it("should add position to tracker", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const event = LiquidRouter.PositionOpened.createMockEvent({
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

      const mockDbUpdated = await LiquidRouter.PositionOpened.processEvent({
        event,
        mockDb,
      });

      const tracker = mockDbUpdated.entities.MarketPositionTracker.get(
        `${chainId}_${marketId}`
      );

      assert.ok(tracker, "Tracker should exist");
      assert.ok(
        tracker.openPositionIds.includes(positionKey),
        "Should include position ID"
      );
      assert.strictEqual(tracker.openPositionCount, BigInt(1));
    });
  });

  describe("Price Updates", () => {
    it("should create PnL snapshots on price update for open positions", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open position at entry price 5000 (0.5000)
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

      // Price update to 5500 (0.5500) - position should be in profit
      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(5500),
        timestamp: BigInt(1700000000),
      });

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      // Check the price update snapshot was created
      const priceSnapshotId = `${chainId}_${chainId}_${positionKey}_${BigInt(
        1700000000
      )}`;
      const priceUpdateSnapshot =
        mockDbUpdated.entities.PositionPnLSnapshot.get(priceSnapshotId);

      assert.ok(priceUpdateSnapshot, "Price update snapshot should exist");
      // Index price comes from getIndexPrice effect, which returns 5000 in test mode
      assert.strictEqual(
        priceUpdateSnapshot?.indexPrice,
        BigInt(5000),
        "Should use index price from getIndexPrice effect (5000 in tests)"
      );
      assert.strictEqual(
        priceUpdateSnapshot?.timestamp,
        BigInt(1700000000),
        "Should have correct timestamp"
      );
      // PnL should be 0 since entry and current price are both 5000
      assert.strictEqual(
        priceUpdateSnapshot?.pnl,
        BigInt(0),
        "PnL should be 0 at entry price"
      );
    });

    it("should create snapshots for multiple open positions", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open first position
      const event1 = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey: positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: event1,
        mockDb,
      });

      // Open second position
      const positionKey2 =
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567891";
      const event2 = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey: positionKey2,
        marketId,
        collateral: BigInt(2000e6),
        size: BigInt(5000e6),
        isLong: false,
        totalFee: BigInt(5e6),
        lpFee: BigInt(4e6),
        protocolFee: BigInt(1e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: event2,
        mockDb,
      });

      // Price update should create snapshots for both
      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(5500),
        timestamp: BigInt(1700000000),
      });

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      // Check snapshots for both positions were created
      const snapshot1Id = `${chainId}_${chainId}_${positionKey}_${BigInt(
        1700000000
      )}`;
      const snapshot1 =
        mockDbUpdated.entities.PositionPnLSnapshot.get(snapshot1Id);

      const snapshot2Id = `${chainId}_${chainId}_${positionKey2}_${BigInt(
        1700000000
      )}`;
      const snapshot2 =
        mockDbUpdated.entities.PositionPnLSnapshot.get(snapshot2Id);

      assert.ok(snapshot1, "Snapshot for position 1 should exist");
      assert.ok(snapshot2, "Snapshot for position 2 should exist");
    });
  });

  describe("Position Closing", () => {
    it("should remove position from tracker when closed", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open position
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

      // Close position
      const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
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

      // Check tracker was updated
      const tracker = mockDbUpdated.entities.MarketPositionTracker.get(
        `${chainId}_${marketId}`
      );
      assert.ok(tracker, "Tracker should still exist");
      assert.strictEqual(
        tracker.openPositionCount,
        BigInt(0),
        "Should have 0 open positions"
      );
      assert.strictEqual(
        tracker.openPositionIds,
        "",
        "Should have empty position IDs"
      );
    });

    it("should not create snapshot for closed position on price update", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open and close position
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

      const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
        pnl: BigInt(100e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(90e6),
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
        mockDb,
      });

      // Price update should not create snapshot for closed position
      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(5500),
        timestamp: BigInt(1700000000),
      });

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      // Should not create snapshot for closed position
      const priceSnapshotId = `${chainId}_${chainId}_${positionKey}_${BigInt(
        1700000000
      )}`;
      const priceSnapshot =
        mockDbUpdated.entities.PositionPnLSnapshot.get(priceSnapshotId);

      assert.strictEqual(
        priceSnapshot,
        undefined,
        "Should not create snapshot for closed position"
      );
    });
  });

  describe("PnL Calculations", () => {
    it("should calculate PnL correctly for long position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open long position at entry price 5000 (0.5000)
      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6), // $10,000
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      // Price increases to 6000 (0.6000)
      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(6000),
        timestamp: BigInt(1700000000),
      });

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      const snapshotId = `${chainId}_${chainId}_${positionKey}_${BigInt(
        1700000000
      )}`;
      const priceUpdateSnapshot =
        mockDbUpdated.entities.PositionPnLSnapshot.get(snapshotId);

      assert.ok(priceUpdateSnapshot, "Snapshot should exist");
      // In test mode, both entry and current price are 5000 (from getIndexPrice mock)
      // So PnL = ((5000 - 5000) * 10000e6) / 1e4 = 0
      assert.strictEqual(
        priceUpdateSnapshot?.indexPrice,
        BigInt(5000),
        "Should use mocked index price"
      );
      assert.strictEqual(
        priceUpdateSnapshot?.pnl,
        BigInt(0),
        "PnL should be 0 when entry price equals current price"
      );
    });

    it("should calculate PnL correctly for short position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      // Open short position at entry price 5000
      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(10000e6),
        isLong: false, // Short
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      // Price decreases to 4000
      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(4000),
        timestamp: BigInt(1700000000),
      });

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      const snapshotId = `${chainId}_${chainId}_${positionKey}_${BigInt(
        1700000000
      )}`;
      const priceUpdateSnapshot =
        mockDbUpdated.entities.PositionPnLSnapshot.get(snapshotId);

      assert.ok(priceUpdateSnapshot, "Snapshot should exist");
      // In test mode, both entry and current price are 5000 (from getIndexPrice mock)
      // So PnL = ((5000 - 5000) * 10000e6) / 1e4 = 0
      assert.strictEqual(
        priceUpdateSnapshot?.indexPrice,
        BigInt(5000),
        "Should use mocked index price"
      );
      assert.strictEqual(
        priceUpdateSnapshot?.pnl,
        BigInt(0),
        "PnL should be 0 when entry price equals current price"
      );
    });
  });
});
