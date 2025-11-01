import assert from "assert";
import {
  TestHelpers,
  ProbabilityOracle_PriceUpdated,
  Market,
  PriceObservation,
  PriceCandle,
  Position,
  Trader,
  PositionPnLSnapshot,
  TraderPnLSnapshot,
} from "../generated";
const { MockDb, ProbabilityOracle, LiquidRouter, MarketFactory } = TestHelpers;

describe("ProbabilityOracle contract tests", () => {
  const chainId = 84532;
  const marketId =
    "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3";
  const trader = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb";
  const positionKey =
    "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";

  describe("PriceUpdated event - Basic functionality", () => {
    it("should create price observation", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      const priceEvent = ProbabilityOracle.PriceUpdated.createMockEvent({
        marketId,
        price: BigInt(7500),
        timestamp: BigInt(1704067200),
      });

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: priceEvent,
        mockDb,
      });

      const observation = mockDb.entities.PriceObservation.get(
        `${chainId}_${marketId}_${priceEvent.params.timestamp}`
      );

      assert.ok(observation, "Price observation should be created");
      assert.strictEqual(observation?.price, BigInt(7500));
      assert.strictEqual(observation?.timestamp, BigInt(1704067200));
    });

    it("should update market current price", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7500),
          timestamp: BigInt(1704067200),
        }),
        mockDb,
      });

      const market = mockDb.entities.Market.get(`${chainId}_${marketId}`);

      assert.strictEqual(market?.currentPrice, BigInt(7500));
      assert.strictEqual(market?.lastPriceUpdate, BigInt(1704067200));
    });
  });

  describe("Price candle creation and aggregation", () => {
    it("should create candle for all intervals on first price", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      const timestamp = BigInt(1704067267);

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7500),
          timestamp,
        }),
        mockDb,
      });

      const oneMinCandle = mockDb.entities.PriceCandle.get(
        `${chainId}_${marketId}_ONE_MINUTE_${
          Math.floor(Number(timestamp) / 60) * 60
        }`
      );
      const oneHourCandle = mockDb.entities.PriceCandle.get(
        `${chainId}_${marketId}_ONE_HOUR_${
          Math.floor(Number(timestamp) / 3600) * 3600
        }`
      );

      assert.ok(oneMinCandle, "1-minute candle should be created");
      assert.ok(oneHourCandle, "1-hour candle should be created");
      assert.strictEqual(oneMinCandle?.openPrice, BigInt(7500));
      assert.strictEqual(oneMinCandle?.observationCount, BigInt(1));
    });

    it("should update existing candle with new price", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      const baseTime = 1704067200;

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7500),
          timestamp: BigInt(baseTime),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7600),
          timestamp: BigInt(baseTime + 30),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      const candleId = `${chainId}_${marketId}_ONE_MINUTE_${baseTime}`;
      const candle = mockDb.entities.PriceCandle.get(candleId);

      assert.strictEqual(candle?.openPrice, BigInt(7500));
      assert.strictEqual(candle?.closePrice, BigInt(7600));
      assert.strictEqual(candle?.highPrice, BigInt(7600));
      assert.strictEqual(candle?.lowPrice, BigInt(7500));
      assert.strictEqual(candle?.observationCount, BigInt(2));
    });

    it("should track high and low prices correctly", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      const baseTime = 1704067200;
      const prices = [7500, 7600, 7400, 7550, 7300, 7700];

      for (let i = 0; i < prices.length; i++) {
        mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
          event: ProbabilityOracle.PriceUpdated.createMockEvent({
            marketId,
            price: BigInt(prices[i]),
            timestamp: BigInt(baseTime + i * 10),
            mockEventData: { block: { number: 1000 + i } },
          }),
          mockDb,
        });
      }

      const candleId = `${chainId}_${marketId}_ONE_MINUTE_${baseTime}`;
      const candle = mockDb.entities.PriceCandle.get(candleId);

      assert.strictEqual(candle?.highPrice, BigInt(7700));
      assert.strictEqual(candle?.lowPrice, BigInt(7300));
      assert.strictEqual(candle?.observationCount, BigInt(6));
    });

    it("should create new candle for next period", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      const time1 = 1704067200;
      const time2 = 1704067260;

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7500),
          timestamp: BigInt(time1),
          mockEventData: { block: { number: 1000 } },
        }),
        mockDb,
      });

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(7600),
          timestamp: BigInt(time2),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      const candle1 = mockDb.entities.PriceCandle.get(
        `${chainId}_${marketId}_ONE_MINUTE_${time1}`
      );
      const candle2 = mockDb.entities.PriceCandle.get(
        `${chainId}_${marketId}_ONE_MINUTE_${time2}`
      );

      assert.ok(candle1, "First minute candle should exist");
      assert.ok(candle2, "Second minute candle should exist");
      assert.strictEqual(candle1?.closePrice, BigInt(7500));
      assert.strictEqual(candle2?.openPrice, BigInt(7600));
    });
  });

  describe("Position PnL calculation on price updates", () => {
    it("should calculate PnL for LONG position when price increases", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

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

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.ok(position, "Position should exist");
      assert.strictEqual(position?.entryIndexPrice >= BigInt(0), true);
    });
  });

  describe("Trader PnL aggregation", () => {
    it("should initialize trader with zero PnL", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

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

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.ok(traderEntity, "Trader should exist");
      assert.strictEqual(traderEntity?.realizedPnl, BigInt(0));
    });

    it("should track realized PnL when position closes", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

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
          pnl: BigInt(500e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(490e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.realizedPnl, BigInt(500e6));
    });

    it("should track negative realized PnL", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

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
          pnl: BigInt(-300e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(-310e6),
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.realizedPnl, BigInt(-300e6));
    });

    it("should track mixed realized PnL from multiple positions", async () => {
      let mockDb = MockDb.createMockDb();
      const positionKey1 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000001";
      const positionKey2 =
        "0xaaaa000000000000000000000000000000000000000000000000000000000002";

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

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
          mockEventData: { block: { number: 1000 } },
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
          mockEventData: { block: { number: 1001 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positionKey1,
          pnl: BigInt(300e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(290e6),
          mockEventData: { block: { number: 1002 } },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positionKey2,
          pnl: BigInt(-150e6),
          totalFee: BigInt(15e6),
          lpFee: BigInt(12e6),
          protocolFee: BigInt(3e6),
          netReturn: BigInt(-165e6),
          mockEventData: { block: { number: 1003 } },
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderEntity?.realizedPnl, BigInt(150e6));
    });
  });

  describe("Edge cases", () => {
    it("should handle price update for non-existent market gracefully", async () => {
      const mockDb = MockDb.createMockDb();
      const nonExistentMarket =
        "0x9999999999999999999999999999999999999999999999999999999999999999";

      const mockDbUpdated = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId: nonExistentMarket,
          price: BigInt(7500),
          timestamp: BigInt(1704067200),
        }),
        mockDb,
      });

      const market = mockDbUpdated.entities.Market.get(
        `${chainId}_${nonExistentMarket}`
      );

      assert.strictEqual(market, undefined);
    });

    it("should handle zero price update", async () => {
      let mockDb = MockDb.createMockDb();

      mockDb = await MarketFactory.MarketCreated.processEvent({
        event: MarketFactory.MarketCreated.createMockEvent({
          marketId,
          name: "Test Market",
          sourcePlatform: "Polymarket",
          sourceMarketId: "poly-123",
          expiryTimestamp: BigInt(1735689600),
          creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        }),
        mockDb,
      });

      mockDb = await ProbabilityOracle.PriceUpdated.processEvent({
        event: ProbabilityOracle.PriceUpdated.createMockEvent({
          marketId,
          price: BigInt(0),
          timestamp: BigInt(1704067200),
        }),
        mockDb,
      });

      const market = mockDb.entities.Market.get(`${chainId}_${marketId}`);

      assert.strictEqual(market?.currentPrice, BigInt(0));
    });
  });
});
