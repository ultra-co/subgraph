import assert from "assert";
import { TestHelpers, MarketFactory_MarketCreated, Market } from "../generated";
const { MockDb, MarketFactory } = TestHelpers;

describe("MarketFactory contract tests", () => {
  const mockDb = MockDb.createMockDb();
  const chainId = 84532;
  const marketId =
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  describe("MarketCreated event", () => {
    it("should create raw event entity correctly", async () => {
      const event = MarketFactory.MarketCreated.createMockEvent({
        marketId,
        name: "Will BTC reach 100k in 2024?",
        sourcePlatform: "Polymarket",
        sourceMarketId: "polymarket-123",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      });

      const mockDbUpdated = await MarketFactory.MarketCreated.processEvent({
        event,
        mockDb,
      });

      const actualEvent =
        mockDbUpdated.entities.MarketFactory_MarketCreated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      const expectedEvent: MarketFactory_MarketCreated = {
        id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
        marketId,
        name: "Will BTC reach 100k in 2024?",
        sourcePlatform: "Polymarket",
        sourceMarketId: "polymarket-123",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      };

      assert.deepEqual(actualEvent, expectedEvent);
    });

    it("should create Market business logic entity correctly", async () => {
      const event = MarketFactory.MarketCreated.createMockEvent({
        marketId,
        name: "Will BTC reach 100k in 2024?",
        sourcePlatform: "Polymarket",
        sourceMarketId: "polymarket-123",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      });

      const mockDbUpdated = await MarketFactory.MarketCreated.processEvent({
        event,
        mockDb,
      });

      const actualMarket = mockDbUpdated.entities.Market.get(
        `${event.chainId}_${marketId}`
      );

      const expectedMarket: Market = {
        id: `${event.chainId}_${marketId}`,
        marketId,
        name: "Will BTC reach 100k in 2024?",
        sourcePlatform: "Polymarket",
        sourceMarketId: "polymarket-123",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        createdAt: BigInt(event.block.timestamp),
        blockNumber: BigInt(event.block.number),
        transactionHash: event.transaction.hash,
      };

      assert.deepEqual(actualMarket, expectedMarket);
    });

    it("should handle multiple markets with different IDs", async () => {
      const marketId1 =
        "0x1111111111111111111111111111111111111111111111111111111111111111";
      const marketId2 =
        "0x2222222222222222222222222222222222222222222222222222222222222222";

      const event1 = MarketFactory.MarketCreated.createMockEvent({
        marketId: marketId1,
        name: "Market 1",
        sourcePlatform: "Polymarket",
        sourceMarketId: "poly-1",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      });

      const event2 = MarketFactory.MarketCreated.createMockEvent({
        marketId: marketId2,
        name: "Market 2",
        sourcePlatform: "Kalshi",
        sourceMarketId: "kalshi-1",
        expiryTimestamp: BigInt(1735689700),
        creator: "0x842d35Cc6634C0532925a3b844Bc9e7595f0bEc",
      });

      let mockDbUpdated = await MarketFactory.MarketCreated.processEvent({
        event: event1,
        mockDb,
      });

      mockDbUpdated = await MarketFactory.MarketCreated.processEvent({
        event: event2,
        mockDb: mockDbUpdated,
      });

      const market1 = mockDbUpdated.entities.Market.get(
        `${chainId}_${marketId1}`
      );
      const market2 = mockDbUpdated.entities.Market.get(
        `${chainId}_${marketId2}`
      );

      assert.ok(market1, "Market 1 should exist");
      assert.ok(market2, "Market 2 should exist");
      assert.strictEqual(market1?.name, "Market 1");
      assert.strictEqual(market2?.name, "Market 2");
    });

    it("should handle empty string market names", async () => {
      const event = MarketFactory.MarketCreated.createMockEvent({
        marketId,
        name: "",
        sourcePlatform: "Polymarket",
        sourceMarketId: "poly-empty",
        expiryTimestamp: BigInt(1735689600),
        creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      });

      const mockDbUpdated = await MarketFactory.MarketCreated.processEvent({
        event,
        mockDb,
      });

      const actualMarket = mockDbUpdated.entities.Market.get(
        `${event.chainId}_${marketId}`
      );

      assert.strictEqual(actualMarket?.name, "");
    });
  });
});
