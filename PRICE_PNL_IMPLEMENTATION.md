# Price & PnL Tracking Implementation Status

## ✅ Completed

### Schema Updates

- ✅ Added `Market.currentPrice`, `Market.indexPrice`
- ✅ Added `PriceObservation` entity
- ✅ Added `PriceCandle` entity with OHLC (renamed: openPrice, highPrice, lowPrice, closePrice)
- ✅ Added `CandleInterval` enum (7 intervals including TWELVE_HOURS)
- ✅ Added `Position.entryIndexPrice`, `Position.currentPnl`, `Position.currentPnlPercentage`
- ✅ Added `PositionPnLSnapshot` entity
- ✅ Added `TraderPnLSnapshot` entity
- ✅ Added `Trader.currentUnrealizedPnl`, `currentRealizedPnl`, `allTimePnl`

### Code Implementation

- ✅ Created `src/effects/getPrice.ts` - RPC call to `getPrice()` contract method
- ✅ Created `src/utils/priceHelpers.ts` - Helper functions for candles and PnL
- ✅ Updated `MarketFactory.ts` - Initialize Market with price fields
- ✅ Updated `ProbabilityOracle.ts` - Complete price update handler with:
  - Price observation storage
  - Index price fetching via RPC
  - Market price updates
  - Candle creation/updates for all 7 intervals
  - Open position PnL recalculation
  - Position PnL snapshot creation
  - Trader PnL aggregation
  - Trader PnL snapshot creation
- ✅ Updated `LiquidRouter.PositionOpened` - Store entry index price via RPC
- ✅ Updated `Trader` initialization - Include PnL fields

## Remaining Tasks

### Handler Updates Needed

- Update `LiquidRouter.PositionClosed` - Add realized PnL to trader
- Update `LiquidRouter.ExpiredPositionSettled` - Add realized PnL to trader
- Update `LiquidRouter.PositionAutoClosedInsufficientFunding` - Update trader PnL
- Update `LiquidationEngine.PositionLiquidated` - Update trader PnL

### Config Updates

- Add `field_selection` for transaction_fields to PriceUpdated event

### Testing

- Create comprehensive tests for price tracking
- Test TWAP calculation accuracy
- Test candle aggregation
- Test PnL calculations
- Test trader PnL aggregation

---

## How It Works

### Price Update Flow

```
PriceUpdated Event
    ↓
1. Store raw event
2. Call getPrice() RPC → Get index price (TWAP)
3. Update Market (currentPrice, indexPrice)
4. Create PriceObservation
5. Update/create 7 candles (ONE_MINUTE through ONE_DAY)
6. For each open position in this market:
   - Calculate PnL using index price
   - Update Position.currentPnl
   - Create PositionPnLSnapshot
7. For each trader with updated positions:
   - Sum unrealizedPnl from open positions
   - Update Trader PnL fields
   - Create TraderPnLSnapshot
```

### PnL Calculation

**Position PnL:**

```typescript
// LONG: profit when price goes up
pnl = (currentIndexPrice - entryIndexPrice) × size / 10000

// SHORT: profit when price goes down
pnl = (entryIndexPrice - currentIndexPrice) × size / 10000

// Percentage (18 decimals)
pnlPercentage = (pnl × 1e18) / collateral
```

**Trader PnL:**

```typescript
unrealizedPnl = sum(position.currentPnl) for all open positions
realizedPnl = sum(position.pnl) for all closed positions
allTimePnl = unrealizedPnl + realizedPnl
```

### Candle Aggregation

**One price update → 7 candles updated:**

```
12:34:27 PM, Price = 7500

Updates:
- ONE_MINUTE    (12:34:00 - 12:35:00)
- FIVE_MINUTES  (12:30:00 - 12:35:00)
- FIFTEEN_MINUTES (12:30:00 - 12:45:00)
- ONE_HOUR      (12:00:00 - 13:00:00)
- FOUR_HOURS    (12:00:00 - 16:00:00)
- TWELVE_HOURS  (12:00:00 - 24:00:00)
- ONE_DAY       (00:00:00 - 24:00:00)
```

---

## Query Examples

### Trader Weekly PnL Chart

```graphql
query TraderWeeklyPnL($traderId: String!, $weekStart: BigInt!) {
  traderPnLSnapshots(
    where: { trader_id: $traderId, timestamp_gte: $weekStart }
    orderBy: "timestamp"
  ) {
    totalPnl
    realizedPnl
    unrealizedPnl
    timestamp
  }
}
```

**Frontend:**

```typescript
const data = snapshots.map((s) => ({
  time: Number(s.timestamp) * 1000,
  value: Number(s.totalPnl) / 1e6,
}));
```

### Market Price Chart (1-Hour Candles)

```graphql
query MarketChart($marketId: String!, $dayStart: BigInt!) {
  priceCandles(
    where: {
      market_id: $marketId
      interval: "ONE_HOUR"
      periodStart_gte: $dayStart
    }
    orderBy: "periodStart"
  ) {
    openPrice
    highPrice
    lowPrice
    closePrice
    indexClose
    periodStart
  }
}
```

**TradingView Format:**

```typescript
const candles = data.priceCandles.map((c) => ({
  time: Number(c.periodStart) * 1000,
  open: Number(c.openPrice),
  high: Number(c.highPrice),
  low: Number(c.lowPrice),
  close: Number(c.closePrice),
}));
```

### Position PnL History

```graphql
query PositionPnL($positionId: String!) {
  position(id: $positionId) {
    currentPnl
    currentPnlPercentage
    entryIndexPrice
    pnlSnapshots(orderBy: "timestamp", limit: 100) {
      pnl
      pnlPercentage
      indexPrice
      timestamp
    }
  }
}
```

---

## Performance Considerations

### Snapshot Frequency

**Current:** Creates snapshot on EVERY price update

**If market gets 100 price updates/hour with 10 open positions:**

```
100 updates × 10 positions = 1,000 position snapshots/hour
100 updates × 10 traders = 1,000 trader snapshots/hour
Total: 2,000 snapshots/hour
```

**Optimization (if needed):**

- Throttle to max 1 snapshot per 5 minutes
- Reduces to ~24 snapshots/hour per entity
- Still maintains good chart resolution

### Candle Storage

**7 intervals × ~1,440 candles/day (1-minute) = ~10,080 candle updates/day**

Most are updates (not creates), so database load is manageable.

---

## Next Steps

1. Update remaining position close handlers for realized PnL
2. Add transaction hash field selection for PriceUpdated event
3. Run codegen
4. Create comprehensive tests
5. Test with real price data

---

## Benefits

### For Traders

- Real-time PnL updates on every price change
- Historical PnL charts (all-time, monthly, weekly)
- Accurate PnL using contract's index price (not manipulable)

### For Analytics

- OHLC candles at 7 different timeframes
- Price history with both spot and index prices
- Volume proxy (observationCount shows activity)

### For TradingView

- Direct compatibility with charting library
- Pre-aggregated OHLC data
- Multiple timeframes without client-side calculation

---

## Configuration Needed

Add to `config.yaml`:

```yaml
- event: PriceUpdated(...)
  field_selection:
    transaction_fields:
      - hash
```

And ensure `preload_handlers: true` is set (already done).
