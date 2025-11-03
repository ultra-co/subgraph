import { experimental_createEffect, S } from "envio";

export const getMarketMetadata = experimental_createEffect(
  {
    name: "getMarketMetadata",
    input: {
      sourceMarketId: S.string,
      sourcePlatform: S.string,
    },
    output: S.nullable(S.string),
  },
  async ({ input, context }) => {
    // Only fetch from Polymarket API for Polymarket markets
    if (input.sourcePlatform.toLowerCase() !== "polymarket") {
      return undefined;
    }

    // Skip API calls in test environment
    if (process.env.SKIP_RPC_IN_TESTS === "true") {
      return "https://polymarket-upload.s3.us-east-2.amazonaws.com/test-image.jpg";
    }

    try {
      const response = await fetch(
        `https://gamma-api.polymarket.com/markets/${input.sourceMarketId}`
      );

      if (!response.ok) {
        context.log.error(
          `Failed to fetch market metadata for ${input.sourceMarketId}: ${response.statusText}`
        );
        return undefined;
      }

      const data = (await response.json()) as { image?: string };

      return data.image || undefined;
    } catch (error) {
      context.log.error(
        `Error fetching market metadata for ${input.sourceMarketId}: ${error}`
      );
      return undefined;
    }
  }
);
