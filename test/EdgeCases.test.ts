import assert from "assert";
import { TestHelpers, Position, Trader } from "../generated";
const { MockDb, LiquidRouter, LiquidationEngine, MarketFactory } = TestHelpers;

describe("Edge cases and defensive programming", () => {
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

  describe("Collateral edge cases", () => {
    it("should handle funding payment exceeding collateral", async () => {
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
        amount: BigInt(2000e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: fundingEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.ok(position, "Position should still exist");
      assert.strictEqual(position?.collateral < BigInt(0), true);
    });

    it("should handle multiple large funding payments", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(100e6),
        size: BigInt(1000e6),
        isLong: true,
        totalFee: BigInt(1e6),
        lpFee: BigInt(0.8e6),
        protocolFee: BigInt(0.2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      for (let i = 0; i < 5; i++) {
        const fundingEvent = LiquidRouter.FundingPaid.createMockEvent({
          positionKey,
          trader,
          marketId,
          amount: BigInt(30e6),
          mockEventData: {
            block: { number: 1000 + i },
            logIndex: 0,
          },
        });

        mockDb = await LiquidRouter.FundingPaid.processEvent({
          event: fundingEvent,
          mockDb,
        });
      }

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.collateral, BigInt(-50e6));
    });
  });

  describe("Double closing scenarios", () => {
    it("should handle closing already closed position", async () => {
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

      const closeEvent1 = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
        pnl: BigInt(100e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(90e6),
        mockEventData: {
          block: { number: 1001 },
          logIndex: 0,
        },
      });

      const closeEvent2 = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
        pnl: BigInt(200e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(190e6),
        mockEventData: {
          block: { number: 1002 },
          logIndex: 0,
        },
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent1,
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent2,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.closed, true);
      assert.strictEqual(position?.pnl, BigInt(100e6));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });

    it("should handle liquidation after manual close", async () => {
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
        pnl: BigInt(100e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(90e6),
        mockEventData: {
          block: { number: 1001 },
        },
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
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
          mockEventData: {
            block: { number: 1002 },
          },
        });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: liquidationEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.liquidated, false);
      assert.strictEqual(position?.closedReason, "MANUAL");
      assert.strictEqual(traderEntity?.liquidatedPositions, BigInt(0));
      assert.strictEqual(traderEntity?.closedPositions, BigInt(1));
    });
  });

  describe("Trader statistics accuracy", () => {
    it("should maintain accurate stats with concurrent operations", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const positions = [];

      for (let i = 0; i < 10; i++) {
        const posKey = `0xaaaa00000000000000000000000000000000000000000000000000000000000${i}`;
        positions.push(posKey);

        const openEvent = LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey: posKey,
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: i % 2 === 0,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: {
            block: { number: 1000 + i },
            logIndex: 0,
          },
        });

        mockDb = await LiquidRouter.PositionOpened.processEvent({
          event: openEvent,
          mockDb,
        });
      }

      const traderAfterOpening = mockDb.entities.Trader.get(
        `${chainId}_${trader}`
      );
      assert.strictEqual(traderAfterOpening?.totalPositions, BigInt(10));
      assert.strictEqual(traderAfterOpening?.openPositions, BigInt(10));
      assert.strictEqual(traderAfterOpening?.totalVolume, BigInt(100000e6));

      for (let i = 0; i < 5; i++) {
        const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positions[i],
          pnl: BigInt(100e6 * (i + 1)),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(90e6 * (i + 1)),
          mockEventData: {
            block: { number: 2000 + i },
            logIndex: 0,
          },
        });

        mockDb = await LiquidRouter.PositionClosed.processEvent({
          event: closeEvent,
          mockDb,
        });
      }

      for (let i = 5; i < 8; i++) {
        const liquidationEvent =
          LiquidationEngine.PositionLiquidated.createMockEvent({
            positionKey: positions[i],
            trader,
            liquidator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
            collateralSeized: BigInt(900e6),
            keeperReward: BigInt(50e6),
            penaltyToVault: BigInt(50e6),
            mockEventData: {
              block: { number: 3000 + i },
              logIndex: 0,
            },
          });

        mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
          event: liquidationEvent,
          mockDb,
        });
      }

      const traderFinal = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(traderFinal?.totalPositions, BigInt(10));
      assert.strictEqual(traderFinal?.openPositions, BigInt(2));
      assert.strictEqual(traderFinal?.closedPositions, BigInt(5));
      assert.strictEqual(traderFinal?.liquidatedPositions, BigInt(3));
    });

    it("should handle funding payments that exceed collateral completely", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(50e6),
        size: BigInt(500e6),
        isLong: true,
        totalFee: BigInt(5e6),
        lpFee: BigInt(4e6),
        protocolFee: BigInt(1e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const largeFundingEvent = LiquidRouter.FundingPaid.createMockEvent({
        positionKey,
        trader,
        marketId,
        amount: BigInt(100e6),
      });

      mockDb = await LiquidRouter.FundingPaid.processEvent({
        event: largeFundingEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.collateral, BigInt(-50e6));
    });
  });

  describe("Order of events scenarios", () => {
    it("should handle funding payment before position exists", async () => {
      let mockDb = MockDb.createMockDb();

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

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const funding = mockDb.entities.Funding.get(
        `${chainId}_${fundingEvent.block.number}_${fundingEvent.logIndex}`
      );

      assert.strictEqual(position, undefined);
      assert.ok(funding, "Funding should be created even without position");
    });

    it("should handle close event before position opened", async () => {
      let mockDb = MockDb.createMockDb();

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

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position, undefined);
      assert.strictEqual(traderEntity, undefined);
    });

    it("should handle liquidation before position opened", async () => {
      let mockDb = MockDb.createMockDb();

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

      assert.strictEqual(position, undefined);
    });
  });

  describe("Extreme value scenarios", () => {
    it("should handle very large position size", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const largeSize = BigInt("1000000000000000000");

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt("100000000000000000"),
        size: largeSize,
        isLong: true,
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.ok(position, "Position should be created");
      assert.strictEqual(position?.size, largeSize);
      assert.strictEqual(traderEntity?.totalVolume, largeSize);
    });

    it("should handle maximum leverage positions", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1e6),
        size: BigInt(100e6),
        isLong: true,
        totalFee: BigInt(1e6),
        lpFee: BigInt(0.8e6),
        protocolFee: BigInt(0.2e6),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );

      assert.strictEqual(position?.leverage, BigInt(100e18));
    });

    it("should handle zero size position", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const openEvent = LiquidRouter.PositionOpened.createMockEvent({
        user: trader,
        positionKey,
        marketId,
        collateral: BigInt(1000e6),
        size: BigInt(0),
        isLong: true,
        totalFee: BigInt(0),
        lpFee: BigInt(0),
        protocolFee: BigInt(0),
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const position = mockDb.entities.Position.get(
        `${chainId}_${positionKey}`
      );
      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.strictEqual(position?.size, BigInt(0));
      assert.strictEqual(position?.leverage, BigInt(0));
      assert.strictEqual(traderEntity?.totalVolume, BigInt(0));
    });
  });

  describe("Stats consistency verification", () => {
    it("should never have negative open positions", async () => {
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

      for (let i = 0; i < 5; i++) {
        const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey,
          pnl: BigInt(50e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(40e6),
          mockEventData: {
            block: { number: 2000 + i },
            logIndex: 0,
          },
        });

        mockDb = await LiquidRouter.PositionClosed.processEvent({
          event: closeEvent,
          mockDb,
        });
      }

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      assert.ok(traderEntity, "Trader should exist");
      assert.ok(
        traderEntity.openPositions >= BigInt(0),
        "Open positions should never be negative"
      );
    });

    it("should maintain totalPositions = openPositions + closedPositions + liquidatedPositions", async () => {
      let mockDb = MockDb.createMockDb();
      mockDb = await createMarket(mockDb);

      const positionKeys = [
        "0xaaaa000000000000000000000000000000000000000000000000000000000001",
        "0xaaaa000000000000000000000000000000000000000000000000000000000002",
        "0xaaaa000000000000000000000000000000000000000000000000000000000003",
        "0xaaaa000000000000000000000000000000000000000000000000000000000004",
        "0xaaaa000000000000000000000000000000000000000000000000000000000005",
      ];

      for (let i = 0; i < 5; i++) {
        const openEvent = LiquidRouter.PositionOpened.createMockEvent({
          user: trader,
          positionKey: positionKeys[i],
          marketId,
          collateral: BigInt(1000e6),
          size: BigInt(10000e6),
          isLong: true,
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          mockEventData: {
            block: { number: 1000 + i },
            logIndex: 0,
          },
        });

        mockDb = await LiquidRouter.PositionOpened.processEvent({
          event: openEvent,
          mockDb,
        });
      }

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positionKeys[0],
          pnl: BigInt(100e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(90e6),
          mockEventData: {
            block: { number: 2000 },
            logIndex: 0,
          },
        }),
        mockDb,
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: LiquidRouter.PositionClosed.createMockEvent({
          user: trader,
          positionKey: positionKeys[1],
          pnl: BigInt(50e6),
          totalFee: BigInt(10e6),
          lpFee: BigInt(8e6),
          protocolFee: BigInt(2e6),
          netReturn: BigInt(40e6),
          mockEventData: {
            block: { number: 2001 },
            logIndex: 0,
          },
        }),
        mockDb,
      });

      mockDb = await LiquidationEngine.PositionLiquidated.processEvent({
        event: LiquidationEngine.PositionLiquidated.createMockEvent({
          positionKey: positionKeys[2],
          trader,
          liquidator: "0x942d35Cc6634C0532925a3b844Bc9e7595f0bEd",
          collateralSeized: BigInt(900e6),
          keeperReward: BigInt(50e6),
          penaltyToVault: BigInt(50e6),
          mockEventData: {
            block: { number: 2002 },
            logIndex: 0,
          },
        }),
        mockDb,
      });

      const traderEntity = mockDb.entities.Trader.get(`${chainId}_${trader}`);

      const totalCalculated =
        (traderEntity?.openPositions || BigInt(0)) +
        (traderEntity?.closedPositions || BigInt(0)) +
        (traderEntity?.liquidatedPositions || BigInt(0));

      assert.strictEqual(
        traderEntity?.totalPositions,
        totalCalculated,
        "Total positions should equal sum of open + closed + liquidated"
      );
    });
  });

  describe("Timestamp tracking accuracy", () => {
    it("should update lastTradedAt on all position events", async () => {
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
        mockEventData: {
          block: { timestamp: 1000000 },
        },
      });

      mockDb = await LiquidRouter.PositionOpened.processEvent({
        event: openEvent,
        mockDb,
      });

      const traderAfterOpen = mockDb.entities.Trader.get(
        `${chainId}_${trader}`
      );
      assert.strictEqual(traderAfterOpen?.firstTradedAt, BigInt(1000000));
      assert.strictEqual(traderAfterOpen?.lastTradedAt, BigInt(1000000));

      const closeEvent = LiquidRouter.PositionClosed.createMockEvent({
        user: trader,
        positionKey,
        pnl: BigInt(100e6),
        totalFee: BigInt(10e6),
        lpFee: BigInt(8e6),
        protocolFee: BigInt(2e6),
        netReturn: BigInt(90e6),
        mockEventData: {
          block: { timestamp: 2000000 },
        },
      });

      mockDb = await LiquidRouter.PositionClosed.processEvent({
        event: closeEvent,
        mockDb,
      });

      const traderAfterClose = mockDb.entities.Trader.get(
        `${chainId}_${trader}`
      );
      assert.strictEqual(traderAfterClose?.firstTradedAt, BigInt(1000000));
      assert.strictEqual(traderAfterClose?.lastTradedAt, BigInt(2000000));
    });
  });
});
