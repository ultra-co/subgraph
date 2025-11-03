import assert from "assert";
import {
  TestHelpers,
  LiquidRouter_PositionOpened,
  LiquidRouter_PositionClosed,
  LiquidRouter_FundingPaid,
  LiquidRouter_FundingReceived,
  LiquidRouter_ExpiredPositionSettled,
  LiquidRouter_MarginAdded,
  LiquidRouter_MarginRemoved,
  Position,
  Trader,
  Funding,
  MarginUpdate,
  Market,
} from "../generated";
const { MockDb, LiquidRouter, MarketFactory } = TestHelpers;

describe("LiquidRouter contract tests", () => {
  const chainId = 84532;
  const trader = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const positionKey =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
  const marketId =
    "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3";

  // Helper function to create a market for tests
  async function createMarket(mockDb: any) {
    const marketEvent = MarketFactory.MarketCreated.createMockEvent({
      marketId,
      name: "Test Market",
      sourcePlatform: "Polymarket",
      sourceMarketId: "test-123",
      expiryTimestamp: BigInt(1735689600),
      creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    });

    return await MarketFactory.MarketCreated.processEvent({
      event: marketEvent,
      mockDb,
    });
  }

  describe("PositionOpened event", () => {
    it("should create new trader on first position", async () => {
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

      const actualTrader = mockDbUpdated.entities.Trader.get(
        `${chainId}_${trader}`
      );

      assert.ok(actualTrader, "Trader should be created");
      assert.strictEqual(actualTrader?.address, trader);
      assert.strictEqual(actualTrader?.totalPositions, BigInt(1));
      assert.strictEqual(actualTrader?.openPositions, BigInt(1));
      assert.strictEqual(actualTrader?.closedPositions, BigInt(0));
      assert.strictEqual(actualTrader?.liquidatedPositions, BigInt(0));
      assert.strictEqual(actualTrader?.totalVolume, BigInt(10000e6));
      assert.strictEqual(actualTrader?.realizedPnl, BigInt(0));

      // Check market volume was updated
      const market = mockDbUpdated.entities.Market.get(
        `${chainId}_${marketId}`
      );
      assert.ok(market, "Market should exist");
      assert.strictEqual(
        market?.volume,
        BigInt(10000e6),
        "Market volume should be updated"
      );
    });

    it("should create position with correct leverage calculation", async () => {
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

      const actualPosition = mockDbUpdated.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.ok(actualPosition, "Position should be created");
      assert.strictEqual(actualPosition?.collateral, BigInt(1000e6));
      assert.strictEqual(actualPosition?.size, BigInt(10000e6));
      assert.strictEqual(actualPosition?.leverage, BigInt(10e18));
      assert.strictEqual(actualPosition?.isLong, true);
      assert.strictEqual(actualPosition?.closed, false);
      assert.strictEqual(actualPosition?.liquidated, false);
      assert.strictEqual(actualPosition?.entryIndexPrice >= BigInt(0), true);
    });

    it("should handle zero collateral gracefully", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const event = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(0),
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

      // Check market volume was updated even with zero collateral
      const market = mockDbUpdated.entities.Market.get(
        `${chainId}_${marketId}`
      );
      assert.ok(market, "Market should exist");
      assert.strictEqual(
        market?.volume,
        BigInt(10000e6),
        "Market volume should be updated"
      );

      const actualPosition = mockDbUpdated.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(actualPosition?.leverage, BigInt(0));
    });

    it("should update existing trader stats", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const positionKey1 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000001";
      const positionKey2 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000002";

      const event1 = LiquidRouter.PositionOpened.createMockEvent({
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

      const event2 = LiquidRouter.PositionOpened.createMockEvent({
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

      let mockDbUpdated = await LiquidRouter.PositionOpened.processEvent({
        event: event1,
        mockDb,
      });

      mockDbUpdated = await LiquidRouter.PositionOpened.processEvent({
        event: event2,
        mockDb: mockDbUpdated,
      });

      const actualTrader = mockDbUpdated.entities.Trader.get(
        `${chainId}_${trader}`
      );

      assert.strictEqual(actualTrader?.totalPositions, BigInt(2));
      assert.strictEqual(actualTrader?.openPositions, BigInt(2));
      assert.strictEqual(actualTrader?.totalVolume, BigInt(25000e6));

      // Check market volume accumulates from both positions
      const market = mockDbUpdated.entities.Market.get(
        `${chainId}_${marketId}`
      );
      assert.ok(market, "Market should exist");
      assert.strictEqual(
        market?.volume,
        BigInt(25000e6),
        "Market volume should accumulate"
      );
    });
  });

  describe("PositionClosed event", () => {
    it("should close position and update trader stats", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const actualTrader = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(actualPosition?.closed, true);
      assert.strictEqual(actualPosition?.closedReason, "MANUAL");
      assert.strictEqual(actualPosition?.pnl, BigInt(500e6));
      assert.strictEqual(actualPosition?.netReturn, BigInt(490e6));

      assert.strictEqual(actualTrader?.openPositions, BigInt(0));
      assert.strictEqual(actualTrader?.closedPositions, BigInt(1));
      assert.strictEqual(actualTrader?.realizedPnl, BigInt(500e6));
    });

    it("should handle negative PnL correctly", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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
        pnl: BigInt(-500e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(-510e6),
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(actualPosition?.pnl, BigInt(-500e6));
      assert.strictEqual(actualPosition?.netReturn, BigInt(-510e6));
    });
  });

  describe("FundingPaid event", () => {
    it("should decrease position collateral when funding is paid", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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

      const fundingEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(50e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const actualFunding = mockDb.entities.Funding.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.strictEqual(actualPosition?.collateral, BigInt(950e6));
      assert.ok(actualFunding, "Funding entity should be created");
      assert.strictEqual(actualFunding?.fundingType, "PAID");
      assert.strictEqual(actualFunding?.amount, BigInt(50e6));
    });

    it("should handle multiple funding payments", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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

      const fundingEvent1 = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(30e6),
      });

      const fundingEvent2 = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(20e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingEvent1,
        mockDb,
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingEvent2,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(actualPosition?.collateral, BigInt(950e6));
    });
  });

  describe("FundingReceived event", () => {
    it("should increase position collateral when funding is received", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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

      const fundingEvent = LiquidRouter.FundingReceived.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(50e6),
      });

      mockDb = await LiquidRouter.FundingReceived.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const actualFunding = mockDb.entities.Funding.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.strictEqual(actualPosition?.collateral, BigInt(1050e6));
      assert.ok(actualFunding, "Funding entity should be created");
      assert.strictEqual(actualFunding?.fundingType, "RECEIVED");
      assert.strictEqual(actualFunding?.amount, BigInt(50e6));
    });

    it("should handle combined funding paid and received", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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

      const paidEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(30e6),
      });

      const receivedEvent = LiquidRouter.FundingReceived.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(50e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: paidEvent,
        mockDb,
      });

      mockDb = await LiquidRouter.FundingReceived.processEvent({
        event: receivedEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(actualPosition?.collateral, BigInt(1020e6));
    });
  });

  describe("ExpiredPositionSettled event", () => {
    it("should mark position as expired and update trader stats", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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
        pnl: BigInt(100e6),
        netReturn: BigInt(90e6),
      });

      mockDb = await LiquidRouter.ExpiredPositionSettled.processEvent({
        event: expiredEvent,
        mockDb,
      });

      const actualPosition = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const actualTrader = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(actualPosition?.closed, true);
      assert.strictEqual(actualPosition?.closedReason, "EXPIRED");
      assert.strictEqual(actualPosition?.pnl, BigInt(100e6));

      assert.strictEqual(actualTrader?.openPositions, BigInt(0));
      assert.strictEqual(actualTrader?.closedPositions, BigInt(1));
    });
  });

  describe("MarginAdded event", () => {
    it("should add margin to existing position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

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
        mockEventData: { block: { number: 1000 } },
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const marginEvent = LiquidRouter.MarginAdded.createMockEvent({
        user: trader,
        positionKey,
        additionalCollateral: BigInt(500e6),
        newTotalCollateral: BigInt(1500e6),
        mockEventData: { block: { number: 1001 } },
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: marginEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);
      const marginUpdate = mockDb.entities.MarginUpdate.get(
        `${chainId}_${marginEvent.block.number}_${marginEvent.logIndex}`
      );

      assert.strictEqual(position?.collateral, BigInt(1500e6));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(10500e6));
      assert.ok(marginUpdate, "MarginUpdate should be created");
      assert.strictEqual(marginUpdate?.updateType, "ADDED");
      assert.strictEqual(marginUpdate?.amount, BigInt(500e6));
      assert.strictEqual(marginUpdate?.newTotalCollateral, BigInt(1500e6));
    });

    it("should handle multiple margin additions", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: LiquidRouter.MarginAdded.createMockEvent({
          user: trader,
          positionKey,
          additionalCollateral: BigInt(300e6),
          newTotalCollateral: BigInt(1300e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: LiquidRouter.MarginAdded.createMockEvent({
          user: trader,
          positionKey,
          additionalCollateral: BigInt(200e6),
          newTotalCollateral: BigInt(1500e6),
          mockEventData: { block: { number: 1002 } },
        }),
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.collateral, BigInt(1500e6));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(10500e6));
    });

    it("should not add margin to closed position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey,
          pnl: BigInt(100e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(90e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: LiquidRouter.MarginAdded.createMockEvent({
          user: trader,
          positionKey,
          additionalCollateral: BigInt(500e6),
          newTotalCollateral: BigInt(1500e6),
          mockEventData: { block: { number: 1002 } },
        }),
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.collateral, BigInt(1000e6));
    });

    it("should not add margin to non-existent position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);
      const nonExistentKey =
        "0xbbbb000000000000000000000000000000000000000000000000000000000000";

      const marginEvent = LiquidRouter.MarginAdded.createMockEvent({
        user: trader,
        positionKey: nonExistentKey,
        additionalCollateral: BigInt(500e6),
        newTotalCollateral: BigInt(1500e6),
      });

      const mockDbUpdated = await LiquidRouter.MarginAdded.processEvent({
        event: marginEvent,
        mockDb,
      });

      const position = mockDbUpdated.entities.Position.get(
        `${chainId}_${nonExistentKey}`
      );

      assert.strictEqual(position, undefined);
    });
  });

  describe("MarginRemoved event", () => {
    it("should remove margin from existing position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      const marginEvent = LiquidRouter.MarginRemoved.createMockEvent({
        user: trader,
        positionKey,
        collateralRemoved: BigInt(300e6),
        newTotalCollateral: BigInt(700e6),
        mockEventData: { block: { number: 1001 } },
      });

      mockDb = await LiquidRouter.MarginRemoved.processEvent({
        event: marginEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);
      const marginUpdate = mockDb.entities.MarginUpdate.get(
        `${chainId}_${marginEvent.block.number}_${marginEvent.logIndex}`
      );

      assert.strictEqual(position?.collateral, BigInt(700e6));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(9700e6));
      assert.ok(marginUpdate, "MarginUpdate should be created");
      assert.strictEqual(marginUpdate?.updateType, "REMOVED");
      assert.strictEqual(marginUpdate?.amount, BigInt(300e6));
    });

    it("should prevent negative totalVolume on margin removal", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
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

      mockDb = await LiquidRouter.MarginRemoved.processEvent({
        event: LiquidRouter.MarginRemoved.createMockEvent({
          user: trader,
          positionKey,
          collateralRemoved: BigInt(15000e6),
          newTotalCollateral: BigInt(500e6),
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.ok(
        (traderEntity?.totalVolume || 0) >= BigInt(0),
        "Total volume should not go negative"
      );
    });

    it("should handle margin add then remove sequence", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: LiquidRouter.MarginAdded.createMockEvent({
          user: trader,
          positionKey,
          additionalCollateral: BigInt(500e6),
          newTotalCollateral: BigInt(1500e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginRemoved.processEvent({
        event: LiquidRouter.MarginRemoved.createMockEvent({
          user: trader,
          positionKey,
          collateralRemoved: BigInt(200e6),
          newTotalCollateral: BigInt(1300e6),
          mockEventData: { block: { number: 1002 } },
        }),
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.collateral, BigInt(1300e6));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(10300e6));
    });

    it("should not remove margin from closed position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey,
          pnl: BigInt(100e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(90e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginRemoved.processEvent({
        event: LiquidRouter.MarginRemoved.createMockEvent({
          user: trader,
          positionKey,
          collateralRemoved: BigInt(300e6),
          newTotalCollateral: BigInt(700e6),
          mockEventData: { block: { number: 1002 } },
        }),
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.collateral, BigInt(1000e6));
    });

    it("should update lastTradedAt on margin changes", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000, timestamp: 1000000 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: LiquidRouter.MarginAdded.createMockEvent({
          user: trader,
          positionKey,
          additionalCollateral: BigInt(500e6),
          newTotalCollateral: BigInt(1500e6),
          mockEventData: { block: { number: 1001, timestamp: 2000000 } },
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.lastTradedAt, BigInt(2000000));
    });

    it("should create MarginUpdate with correct position and trader links", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      const marginEvent = LiquidRouter.MarginAdded.createMockEvent({
        user: trader,
        positionKey,
        additionalCollateral: BigInt(500e6),
        newTotalCollateral: BigInt(1500e6),
        mockEventData: { block: { number: 1001 } },
      });

      mockDb = await LiquidRouter.MarginAdded.processEvent({
        event: marginEvent,
        mockDb,
      });

      const marginUpdate = mockDb.entities.MarginUpdate.get(
        `${chainId}_${marginEvent.block.number}_${marginEvent.logIndex}`
      );

      assert.strictEqual(
        marginUpdate?.position_id,
        `${chainId}_${positionKey}`
      );
      assert.strictEqual(marginUpdate?.trader_id, `${chainId}_${trader}`);
    });
  });
});
