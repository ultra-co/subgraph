import assert from "assert";
import { 
  TestHelpers,
  FundingRateManager_FundingRateCalculated
} from "generated";
const { MockDb, FundingRateManager } = TestHelpers;

describe("FundingRateManager contract FundingRateCalculated event tests", () => {
  // Create mock db
  const mockDb = MockDb.createMockDb();

  // Creating mock for FundingRateManager contract FundingRateCalculated event
  const event = FundingRateManager.FundingRateCalculated.createMockEvent({/* It mocks event fields with default values. You can overwrite them if you need */});

  it("FundingRateManager_FundingRateCalculated is created correctly", async () => {
    // Processing the event
    const mockDbUpdated = await FundingRateManager.FundingRateCalculated.processEvent({
      event,
      mockDb,
    });

    // Getting the actual entity from the mock database
    let actualFundingRateManagerFundingRateCalculated = mockDbUpdated.entities.FundingRateManager_FundingRateCalculated.get(
      `${event.chainId}_${event.block.number}_${event.logIndex}`
    );

    // Creating the expected entity
    const expectedFundingRateManagerFundingRateCalculated: FundingRateManager_FundingRateCalculated = {
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      marketId: event.params.marketId,
      fundingRate: event.params.fundingRate,
      skew: event.params.skew,
      timestamp: event.params.timestamp,
    };
    // Asserting that the entity in the mock database is the same as the expected entity
    assert.deepEqual(actualFundingRateManagerFundingRateCalculated, expectedFundingRateManagerFundingRateCalculated, "Actual FundingRateManagerFundingRateCalculated should be the same as the expectedFundingRateManagerFundingRateCalculated");
  });
});
