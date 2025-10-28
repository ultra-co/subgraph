import assert from "assert";
import {
  TestHelpers,
  FundingRateManager_FundingRateCalculated,
} from "../generated";
const { MockDb, FundingRateManager } = TestHelpers;

describe("FundingRateManager contract tests", () => {
  const chainId = 84532;
  const marketId =
    "0x1111111111111111111111111111111111111111111111111111111111111111";

  describe("FundingRateCalculated event", () => {
    it("should create funding rate entity correctly", async () => {
      const mockDb = MockDb.createMockDb();
      const event = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(100),
        skew: BigInt(5000e6),
        timestamp: BigInt(1735689600),
      });

      const mockDbUpdated =
        await FundingRateManager.FundingRateCalculated.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.FundingRateManager_FundingRateCalculated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      const expectedEvent: FundingRateManager_FundingRateCalculated = {
        id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
        marketId,
        fundingRate: BigInt(100),
        skew: BigInt(5000e6),
        timestamp: BigInt(1735689600),
      };

      assert.deepEqual(actualEvent, expectedEvent);
    });

    it("should handle negative funding rate", async () => {
      const mockDb = MockDb.createMockDb();
      const event = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(-150),
        skew: BigInt(-3000e6),
        timestamp: BigInt(1735689600),
      });

      const mockDbUpdated =
        await FundingRateManager.FundingRateCalculated.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.FundingRateManager_FundingRateCalculated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      assert.strictEqual(actualEvent?.fundingRate, BigInt(-150));
      assert.strictEqual(actualEvent?.skew, BigInt(-3000e6));
    });

    it("should handle zero funding rate", async () => {
      const mockDb = MockDb.createMockDb();
      const event = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(0),
        skew: BigInt(0),
        timestamp: BigInt(1735689600),
      });

      const mockDbUpdated =
        await FundingRateManager.FundingRateCalculated.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.FundingRateManager_FundingRateCalculated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      assert.strictEqual(actualEvent?.fundingRate, BigInt(0));
      assert.strictEqual(actualEvent?.skew, BigInt(0));
    });

    it("should handle multiple funding rate calculations for same market", async () => {
      let mockDb = MockDb.createMockDb();

      const event1 = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(100),
        skew: BigInt(5000e6),
        timestamp: BigInt(1735689600),
        mockEventData: {
          block: { number: 1000 },
          logIndex: 0,
        },
      });

      const event2 = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(150),
        skew: BigInt(7000e6),
        timestamp: BigInt(1735693200),
        mockEventData: {
          block: { number: 1001 },
          logIndex: 0,
        },
      });

      mockDb = await FundingRateManager.FundingRateCalculated.processEvent({
        event: event1,
        mockDb,
      });

      mockDb = await FundingRateManager.FundingRateCalculated.processEvent({
        event: event2,
        mockDb,
      });

      const actualEvent1 =
        mockDb.entities.FundingRateManager_FundingRateCalculated.get(
          `${chainId}_${event1.block.number}_${event1.logIndex}`
        );

      const actualEvent2 =
        mockDb.entities.FundingRateManager_FundingRateCalculated.get(
          `${chainId}_${event2.block.number}_${event2.logIndex}`
        );

      assert.ok(actualEvent1, "First funding rate should exist");
      assert.ok(actualEvent2, "Second funding rate should exist");
      assert.strictEqual(actualEvent1?.fundingRate, BigInt(100));
      assert.strictEqual(actualEvent2?.fundingRate, BigInt(150));
    });

    it("should handle large skew values", async () => {
      const mockDb = MockDb.createMockDb();
      const largeSkew = BigInt("1000000000000");

      const event = FundingRateManager.FundingRateCalculated.createMockEvent({
        marketId,
        fundingRate: BigInt(500),
        skew: largeSkew,
        timestamp: BigInt(1735689600),
      });

      const mockDbUpdated =
        await FundingRateManager.FundingRateCalculated.processEvent({
          event,
          mockDb,
        });

      const actualEvent =
        mockDbUpdated.entities.FundingRateManager_FundingRateCalculated.get(
          `${event.chainId}_${event.block.number}_${event.logIndex}`
        );

      assert.strictEqual(actualEvent?.skew, largeSkew);
    });
  });
});
