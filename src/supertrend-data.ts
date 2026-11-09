export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
};

export type SupertrendPoint = {
  atr: number | null;
  upper: number | null;
  lower: number | null;
  value: number | null;
  direction: 1 | -1 | null;
};

const anchorsByShape = {
  // Add ordinary two-sided swings around the broad path. These profiles should
  // read like a market, not a sequence of uninterrupted green candles.
  pullback: [90, 94, 92, 98, 96, 103, 100, 107, 105, 111, 109, 107, 104, 102, 103.5, 106, 104.5, 109, 107, 114, 111, 118, 116, 122, 119, 127, 124, 133, 130, 137],
  // The final leg is an actual close below the trailing Supertrend, after the
  // deep pullback has first held and the uptrend has resumed.
  story: [70, 76, 73, 81, 78, 87, 84, 94, 91, 101, 97, 107, 111, 108, 104, 100, 99, 103, 100, 108, 114, 111, 120, 117, 127, 132, 128, 123, 115, 112, 109, 105, 100, 94, 88],
  trend: [82, 87, 84, 90, 88, 95, 92, 99, 97, 104, 101, 109, 107, 114, 111, 119, 116, 125],
  reversal: [100, 104, 102, 108, 106, 112, 110, 116, 114, 117, 114, 111, 113, 108, 104, 107, 101, 97, 100, 94, 90],
  range: [100, 102, 99, 101, 98, 100, 102, 99, 101, 98, 100, 102, 99, 101],
  volatility: [100, 101, 100, 101, 100, 102, 97, 104, 95, 105, 93, 107, 92, 108],
} as const;

type Shape = keyof typeof anchorsByShape;

const seededNoise = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

export const createCandles = (shape: Shape, count = 78): Candle[] => {
  const anchors = anchorsByShape[shape];
  const closes = Array.from({length: count}, (_, index) => {
    if (shape === "range") {
      // A genuinely sideways, two-sided oscillation: it should create repeated
      // close-throughs of the trailing band instead of a barely moving ribbon.
      return 100 + 7.2 * Math.sin((2 * Math.PI * index) / 24) + 1.15 * Math.sin(index * 0.91) + 0.8 * seededNoise(index, 19);
    }
    const scaled = (index / (count - 1)) * (anchors.length - 1);
    const left = Math.floor(scaled);
    const ratio = scaled - left;
    const base = anchors[left] + ((anchors[Math.min(left + 1, anchors.length - 1)] - anchors[left]) * ratio);
    const inDeepPullback = (shape === "pullback" || shape === "story") && index > count * 0.39 && index < count * 0.56;
    const volatility = shape === "volatility" && index > count * 0.42 ? 2.15 : inDeepPullback ? 0.58 : shape === "pullback" ? 1.15 : shape === "story" ? 0.9 : 1.0;
    // Combine broad swings with irregular bar-to-bar noise; the ATR scene's
    // more varied candle texture is the visual reference for these charts.
    const ordinarySwing = Math.sin(index * 1.37) * volatility * 0.55 + Math.sin(index * 0.43) * volatility * 0.42 + Math.sin(index * 2.31) * volatility * 0.2 + seededNoise(index, shape === "story" ? 7 : 3) * (shape === "pullback" || shape === "story" ? 1.05 : 0.45);
    return base + ordinarySwing;
  });

  return closes.map((close, index) => {
    const previous = closes[Math.max(0, index - 1)];
    const gap = Math.sin(index * 2.11) * 0.4 + Math.sin(index * 0.77) * 0.18 + seededNoise(index, 13) * 0.35;
    const open = index === 0 ? close - 0.35 : previous + gap;
    const inDeepPullback = (shape === "pullback" || shape === "story") && index > count * 0.39 && index < count * 0.56;
    const width = shape === "volatility" && index > count * 0.42
      ? 1.25 + (index % 4) * 0.55
      : shape === "range" ? 0.55 : inDeepPullback ? 1.25 + (index % 4) * 0.38 : shape === "pullback" || shape === "story" ? 0.95 + (index % 4) * 0.37 + Math.abs(seededNoise(index, 29)) * 0.35 : 0.62 + (index % 3) * 0.22;
    return {
      open,
      high: Math.max(open, close) + width,
      low: Math.min(open, close) - width * (0.9 + (index % 2) * 0.12),
      close,
    };
  });
};

export const calculateSupertrend = (
  candles: Candle[],
  period = 10,
  multiplier = 3,
): SupertrendPoint[] => {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) return candle.high - candle.low;
    const previousClose = candles[index - 1].close;
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });

  const atrs: Array<number | null> = candles.map(() => null);
  if (candles.length < period) return candles.map(() => ({atr: null, upper: null, lower: null, value: null, direction: null}));
  let atr = trueRanges.slice(0, period).reduce((sum, range) => sum + range, 0) / period;
  atrs[period - 1] = atr;
  for (let index = period; index < candles.length; index++) {
    atr = ((atr * (period - 1)) + trueRanges[index]) / period;
    atrs[index] = atr;
  }

  const result: SupertrendPoint[] = candles.map(() => ({atr: null, upper: null, lower: null, value: null, direction: null}));
  let previousUpper = Number.NaN;
  let previousLower = Number.NaN;
  let direction: 1 | -1 = 1;

  for (let index = period - 1; index < candles.length; index++) {
    const currentAtr = atrs[index];
    if (currentAtr === null) continue;
    const candle = candles[index];
    const midpoint = (candle.high + candle.low) / 2;
    const basicUpper = midpoint + multiplier * currentAtr;
    const basicLower = midpoint - multiplier * currentAtr;
    const previousClose = index === 0 ? candle.close : candles[index - 1].close;
    const finalUpper = Number.isNaN(previousUpper) || basicUpper < previousUpper || previousClose > previousUpper
      ? basicUpper
      : previousUpper;
    const finalLower = Number.isNaN(previousLower) || basicLower > previousLower || previousClose < previousLower
      ? basicLower
      : previousLower;

    if (index > period - 1) {
      if (direction === -1 && candle.close > previousUpper) direction = 1;
      else if (direction === 1 && candle.close < previousLower) direction = -1;
    } else {
      // Seed the first valid state as an uptrend for this explanatory sample;
      // there is not yet a prior active band to define a real reversal.
      direction = 1;
    }

    result[index] = {
      atr: currentAtr,
      upper: finalUpper,
      lower: finalLower,
      value: direction === 1 ? finalLower : finalUpper,
      direction,
    };
    previousUpper = finalUpper;
    previousLower = finalLower;
  }

  return result;
};

export const calculateSMA = (candles: Candle[], period = 20): Array<number | null> => (
  candles.map((_, index) => {
    if (index < period - 1) return null;
    const window = candles.slice(index - period + 1, index + 1);
    return window.reduce((sum, candle) => sum + candle.close, 0) / period;
  })
);
