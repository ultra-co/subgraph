## Envio Indexer - Liquid Protocol

_Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features_

![CI](https://github.com/YOUR_USERNAME/liquid-protocol-graph/actions/workflows/ci.yml/badge.svg)

### Run

```bash
npm run dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
npm run codegen
```

### Test

```bash
npm test
```

**Test Coverage:** 64 comprehensive tests covering all handlers and edge cases

### Pre-requisites

- [Node.js v20](https://nodejs.org/en/download/current) (required for Envio)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

## Project Structure

```
src/
├── FundingRateManager.ts    # Funding rate calculation handlers
├── LiquidationEngine.ts     # Liquidation and keeper reward handlers
├── LiquidRouter.ts          # Position lifecycle handlers
├── LLPVault.ts              # Vault deposit/withdrawal handlers
├── MarketFactory.ts         # Market creation handlers
└── ProbabilityOracle.ts     # Price oracle handlers

test/
├── FundingRateManager.test.ts
├── LiquidationEngine.test.ts
├── LiquidRouter.test.ts
├── LLPVault.test.ts
├── MarketFactory.test.ts
├── IntegrationTests.test.ts
└── EdgeCases.test.ts

schema.graphql              # GraphQL schema with business logic entities
config.yaml                 # Envio indexer configuration
```

## Entities

### Business Logic Entities

- **Market** - Prediction markets with metadata
- **Position** - Trading positions with full lifecycle tracking
- **Trader** - User statistics and trading history
- **Funding** - Funding payment tracking (paid/received)

### Raw Event Entities

All contract events are stored as separate entities for complete audit trail.

## Development Workflow

1. **Make changes** to schema or handlers
2. **Run codegen** to regenerate types
   ```bash
   npm run codegen
   ```
3. **Run tests** to verify changes
   ```bash
   npm test
   ```
4. **Type check** before committing
   ```bash
   npx tsc --noEmit
   ```
5. **Start indexer** to test runtime
   ```bash
   npm run dev
   ```

## Data Precision Guide

### Understanding BigInt and Decimal Precision

This indexer uses **two different precision levels** depending on the data type:

#### 1. Raw Amounts (Token Native Decimals)

**What:** Direct values from smart contract events (USDC amounts, share counts, etc.)

**Decimals:** 6 decimals (USDC standard)

**Fields:**

- `Position.collateral`, `Position.size`
- `Vault.totalAssets`, `Vault.totalRevenue`
- `Trader.totalVolume`
- `VaultDeposit.assetsDeposited`, `VaultWithdrawal.assetsWithdrawn`
- All fee amounts (`tradingFeesCollected`, `liquidationFeesCollected`, etc.)

**Why 6 decimals?**

- USDC natively uses 6 decimals on-chain
- We store exactly what the smart contract emits
- No conversion = no precision loss
- Easy to verify against blockchain data

**Example Query:**

```graphql
query {
  vault(id: "84532_vault") {
    totalAssets # Returns: "10000000000"
  }
}
```

**Frontend Formatting:**

```typescript
import { formatUnits } from "viem";

// Method 1: Using viem
const totalAssets = "10000000000";
const readable = formatUnits(BigInt(totalAssets), 6);
console.log(readable); // "10000" (10,000 USDC)

// Method 2: Manual
const manual = Number(totalAssets) / 1e6;
console.log(manual); // 10000

// Method 3: With formatting
const formatted = (Number(totalAssets) / 1e6).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
console.log(formatted); // "10,000.00"
```

---

#### 2. Calculated Ratios (18 Decimal Precision)

**What:** Calculated values like prices, leverage, averages

**Decimals:** 18 decimals (DeFi standard for precision)

**Fields:**

- `Position.leverage`
- `Vault.sharePrice`
- `Shareholder.averageDepositPrice`
- `VaultDeposit.sharePrice`, `VaultWithdrawal.sharePrice`
- `VaultRevenue.vaultSharePrice`

**Why 18 decimals?**

- **BigInt only does integer math** - division truncates decimals
- **Need high precision** - 1.05 becomes 1 without it
- **DeFi standard** - Ethereum, Uniswap, Aave all use 18 decimals
- **Preserves accuracy** - No rounding errors in calculations

**The Problem Without Precision:**

```typescript
// Without precision (WRONG)
sharePrice = 11,000 USDC / 10,000 shares = 1.1
BigInt: 11000 / 10000 = 1  ❌ Lost 0.1!

// With 18 decimal precision (CORRECT)
sharePrice = (11,000 * 1e18) / 10,000 = 1.1e18  ✅ Preserved!
```

**Example Query:**

```graphql
query {
  vault(id: "84532_vault") {
    sharePrice # Returns: "1050000000000000000"
  }

  position(id: "84532_0xabc...") {
    leverage # Returns: "10500000000000000000"
  }
}
```

**Frontend Formatting:**

```typescript
import { formatUnits } from "viem";

// Share Price (1.05 USDC per LLP)
const sharePrice = "1050000000000000000";
const readable = formatUnits(BigInt(sharePrice), 18);
console.log(readable); // "1.05"

// Leverage (10.5x)
const leverage = "10500000000000000000";
const leverageValue = formatUnits(BigInt(leverage), 18);
console.log(`${leverageValue}x`); // "10.5x"

// Manual calculation
const manual = Number(sharePrice) / 1e18;
console.log(manual); // 1.05
```

---

### Quick Reference Table

| Field         | Example Value          | Decimals | Divide By | Readable    |
| ------------- | ---------------------- | -------- | --------- | ----------- |
| `totalAssets` | `10000000000`          | 6        | `1e6`     | 10,000 USDC |
| `collateral`  | `1000000000`           | 6        | `1e6`     | 1,000 USDC  |
| `sharePrice`  | `1050000000000000000`  | 18       | `1e18`    | 1.05        |
| `leverage`    | `10500000000000000000` | 18       | `1e18`    | 10.5x       |
| `totalVolume` | `50000000000`          | 6        | `1e6`     | 50,000 USDC |

---

### Why This Approach?

**Amounts (6 decimals):**

- ✅ Matches on-chain USDC decimals
- ✅ No conversion needed from events
- ✅ Easy to verify against blockchain
- ✅ Standard for token amounts

**Ratios (18 decimals):**

- ✅ Solves BigInt integer division problem
- ✅ Preserves decimal precision (1.05, 10.5, etc.)
- ✅ Industry standard (Uniswap, Aave, Compound)
- ✅ Prevents rounding errors

**This is how ALL major DeFi protocols work!** It's not confusing once you understand the pattern:

- **Direct amounts** = token decimals (6 for USDC)
- **Calculated values** = 18 decimals (for precision)

---

### Complete Frontend Example

```typescript
import { formatUnits } from "viem";

// Fetch data
const response = await fetch("http://localhost:8080/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    query: `
      query {
        vault(id: "84532_vault") {
          totalAssets
          sharePrice
          totalRevenue
        }
        position(id: "84532_0xabc...") {
          collateral
          size
          leverage
        }
      }
    `,
  }),
});

const data = await response.json();

// Format amounts (6 decimals)
const totalAssets = formatUnits(BigInt(data.vault.totalAssets), 6);
const totalRevenue = formatUnits(BigInt(data.vault.totalRevenue), 6);
const collateral = formatUnits(BigInt(data.position.collateral), 6);
const size = formatUnits(BigInt(data.position.size), 6);

console.log(`Total Assets: $${totalAssets} USDC`);
// "Total Assets: $10000 USDC"

console.log(`Total Revenue: $${totalRevenue} USDC`);
// "Total Revenue: $1500 USDC"

// Format ratios (18 decimals)
const sharePrice = formatUnits(BigInt(data.vault.sharePrice), 18);
const leverage = formatUnits(BigInt(data.position.leverage), 18);

console.log(`Share Price: ${sharePrice} USDC/LLP`);
// "Share Price: 1.05 USDC/LLP"

console.log(`Leverage: ${leverage}x`);
// "Leverage: 10.5x"

// Calculate profit
const estimatedValue =
  (BigInt(shareholder.currentShares) * BigInt(vault.sharePrice)) / BigInt(1e18);

const profit = formatUnits(
  estimatedValue - BigInt(shareholder.totalDeposited),
  6
);
console.log(`Profit: $${profit} USDC`);
```

---

## CI/CD

GitHub Actions automatically run tests on all PRs to `main`. All tests must pass before merging.
