/**
 * Standalone script to test getPrice() RPC call
 * 
 * Usage:
 *   npx ts-node scripts/testGetPrice.ts
 */

import { ethers } from "ethers";

const ORACLE_ADDRESS = "0x0AF43F745d3Db1e184b72A6dA4023F131f6bFbD0";
const MARKET_ID = "0x11a7b57e001bda319e451764e4feeb8705831bcb55eb9b4a4f9bf6a0b21179a3";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

async function testGetPrice() {
  console.log("🔍 Testing getPrice() RPC Call\n");
  console.log("Configuration:");
  console.log(`  Oracle Address: ${ORACLE_ADDRESS}`);
  console.log(`  Market ID: ${MARKET_ID}`);
  console.log(`  RPC URL: ${RPC_URL}\n`);

  try {
    console.log("Connecting to Base Sepolia...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const network = await provider.getNetwork();
    console.log(`✅ Connected to chain ID: ${network.chainId}\n`);

    console.log("Creating contract instance...");
    const oracleContract = new ethers.Contract(
      ORACLE_ADDRESS,
      ["function getPrice(bytes32 marketId) external view returns (uint96)"],
      provider
    );
    console.log("✅ Contract instance created\n");

    console.log("Calling getPrice()...");
    const indexPrice = await oracleContract.getPrice(MARKET_ID);
    
    console.log("\n✅ SUCCESS!");
    console.log(`Index Price (raw): ${indexPrice.toString()}`);
    console.log(`Index Price (basis points): ${Number(indexPrice) / 100}%`);
    console.log(`Index Price (decimal): ${Number(indexPrice) / 10000}`);
    
    return indexPrice;
  } catch (error) {
    console.log("\n❌ FAILED!");
    console.error("Error:", error);
    
    if (error instanceof Error) {
      console.error("\nError details:");
      console.error(`  Message: ${error.message}`);
      console.error(`  Name: ${error.name}`);
    }
    
    throw error;
  }
}

// Run the test
testGetPrice()
  .then(() => {
    console.log("\n🎉 RPC test completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.log("\n💥 RPC test failed!");
    process.exit(1);
  });

