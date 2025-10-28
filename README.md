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

## CI/CD

GitHub Actions automatically run tests on all PRs to `main`. All 64 tests must pass before merging.

See [.github/WORKFLOWS.md](.github/WORKFLOWS.md) for details.
