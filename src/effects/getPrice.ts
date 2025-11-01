import { experimental_createEffect, S } from "envio";

const ORACLE_ADDRESS = "0x0AF43F745d3Db1e184b72A6dA4023F131f6bFbD0";

export const getIndexPrice = experimental_createEffect(
  {
    name: "getIndexPrice",
    input: {
      marketId: S.string,
      blockNumber: S.number,
    },
    output: S.nullable(S.string),
  },
  async ({ input, context }) => {
    // Skip RPC calls in test environment
    if (process.env.SKIP_RPC_IN_TESTS === "true") {
      return "7500"; // Mock index price for tests
    }

    try {
      const ethers = await import("ethers");

      const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL || "https://sepolia.base.org"
      );

      const oracleContract = new ethers.Contract(
        ORACLE_ADDRESS,
        ["function getPrice(bytes32 marketId) external view returns (uint96)"],
        provider
      );

      const indexPrice = await oracleContract.getPrice(input.marketId, {
        blockTag: "latest",
      });

      return indexPrice.toString();
    } catch (error) {
      context.log.error(
        `Failed to get index price for market ${input.marketId}: ${error}`
      );
      return null;
    }
  }
);
