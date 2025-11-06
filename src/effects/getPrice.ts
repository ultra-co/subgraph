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
    if (process.env.SKIP_RPC_IN_TESTS === "true") {
      // Return a mock price based on blockNumber for test flexibility
      // This allows tests to simulate different price scenarios
      return "5000";
    }

    try {
      const ethers = await import("ethers");

      const provider = new ethers.JsonRpcProvider(
        process.env.RPC_URL ||
          "https://base-sepolia.g.alchemy.com/v2/2Lc0JacQ6CvrrvSTGBC3KxpJLXCUArbt"
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
