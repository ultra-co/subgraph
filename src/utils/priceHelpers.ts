export function getPeriodStart(timestamp: bigint, interval: string): bigint {
  const ts = Number(timestamp);

  switch (interval) {
    case "ONE_MINUTE":
      return BigInt(Math.floor(ts / 60) * 60);

    case "FIVE_MINUTES":
      return BigInt(Math.floor(ts / 300) * 300);

    case "FIFTEEN_MINUTES":
      return BigInt(Math.floor(ts / 900) * 900);

    case "ONE_HOUR":
      return BigInt(Math.floor(ts / 3600) * 3600);

    case "FOUR_HOURS":
      return BigInt(Math.floor(ts / 14400) * 14400);

    case "TWELVE_HOURS":
      return BigInt(Math.floor(ts / 43200) * 43200);

    case "ONE_DAY":
      return BigInt(Math.floor(ts / 86400) * 86400);

    default:
      return BigInt(ts);
  }
}

export function getPeriodDuration(interval: string): bigint {
  switch (interval) {
    case "ONE_MINUTE":
      return BigInt(60);
    case "FIVE_MINUTES":
      return BigInt(300);
    case "FIFTEEN_MINUTES":
      return BigInt(900);
    case "ONE_HOUR":
      return BigInt(3600);
    case "FOUR_HOURS":
      return BigInt(14400);
    case "TWELVE_HOURS":
      return BigInt(43200);
    case "ONE_DAY":
      return BigInt(86400);
    default:
      return BigInt(60);
  }
}

export function calculatePositionPnl(
  position: {
    isLong: boolean;
    size: bigint;
    entryIndexPrice: bigint;
  },
  currentIndexPrice: bigint
): bigint {
  if (position.isLong) {
    return (
      ((currentIndexPrice - position.entryIndexPrice) * position.size) /
      BigInt(1e4)
    );
  } else {
    return (
      ((position.entryIndexPrice - currentIndexPrice) * position.size) /
      BigInt(1e4)
    );
  }
}

export function calculatePnlPercentage(
  pnl: bigint,
  collateral: bigint,
  precision: bigint = BigInt(1e18)
): bigint {
  if (collateral === BigInt(0)) return BigInt(0);
  return (pnl * precision) / collateral;
}
