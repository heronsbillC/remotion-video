export type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
};

export type MacdCross = {
  index: number;
  kind: 'golden' | 'death';
  zone: 'above' | 'below';
};

const closePrices = [100];

for (let index = 1; index < 100; index++) {
  let drift: number;
  let volatility: number;
  if (index < 13) {
    drift = 0.013;
    volatility = 0.018;
  } else if (index < 21) {
    drift = [0.009, 0.006, -0.002, 0.006, 0.004, -0.001, 0.004, 0.003][index - 13];
    volatility = 0.006;
  } else if (index < 28) {
    drift = -0.006;
    volatility = 0.009;
  } else if (index < 42) {
    drift = 0.0065;
    volatility = 0.012;
  } else if (index < 53) {
    drift = -0.02;
    volatility = 0.023;
  } else if (index < 58) {
    drift = 0.022;
    volatility = 0.014;
  } else if (index < 63) {
    drift = -0.016;
    volatility = 0.02;
  } else if (index < 74) {
    drift = 0.009;
    volatility = 0.016;
  } else if (index < 82) {
    drift = -0.012;
    volatility = 0.019;
  } else {
    drift = 0.011;
    volatility = 0.018;
  }

  // Deterministic irregularity: a few incommensurate waves replace render-time randomness.
  const variation = Math.sin(index * 1.73) * 0.58 + Math.sin(index * 0.43) * 0.27 + Math.cos(index * 2.91) * 0.15;
  closePrices.push(closePrices[index - 1] * Math.exp(drift + volatility * variation));
}

const ema = (values: number[], period: number) => {
  const alpha = 2 / (period + 1);
  let previous = values[0];
  return values.map((value, index) => {
    previous = index === 0 ? value : value * alpha + previous * (1 - alpha);
    return previous;
  });
};

const candles: Candle[] = closePrices.map((close, index) => {
  const previousClose = index === 0 ? close : closePrices[index - 1];
  const open = index === 0 ? close * 0.997 : previousClose * (1 + Math.sin(index * 1.21) * 0.0018);
  const spread = 0.003 + (0.003 + 0.002 * Math.sin(index * 2.17)) * (index >= 42 && index < 58 ? 2.2 : 1);
  const high = Math.max(open, close) * (1 + spread * (0.34 + (Math.sin(index * 0.93) + 1) * 0.22));
  const low = Math.min(open, close) * (1 - spread * (0.3 + (Math.cos(index * 1.37) + 1) * 0.24));
  return {open, high, low, close};
});

const closes = candles.map(({close}) => close);
const fastEma = ema(closes, 12);
const slowEma = ema(closes, 26);
const macd = fastEma.map((value, index) => value - slowEma[index]);
const signal = ema(macd, 9);
const histogram = macd.map((value, index) => value - signal[index]);

const crosses: MacdCross[] = [];
for (let index = 1; index < macd.length; index++) {
  const previousDifference = macd[index - 1] - signal[index - 1];
  const currentDifference = macd[index] - signal[index];
  if (previousDifference * currentDifference < 0) {
    crosses.push({
      index,
      kind: currentDifference > 0 ? 'golden' : 'death',
      zone: macd[index] >= 0 ? 'above' : 'below',
    });
  }
}

export const macdSeries = {candles, fastEma, slowEma, macd, signal, histogram, crosses};

export const firstPositiveShrinkingRun = {start: 13, end: 20};
export const divergencePeaks = {first: 20, second: 41};

const getCross = (kind: MacdCross['kind'], zone: MacdCross['zone']) => {
  const match = crosses.find((cross) => cross.kind === kind && cross.zone === zone);
  if (!match) throw new Error(`Missing computed ${zone}-zero ${kind} cross`);
  return match;
};

const belowDeath = getCross('death', 'below');
const belowGoldenAfterDeath = crosses.find((cross) => cross.kind === 'golden' && cross.zone === 'below' && cross.index > belowDeath.index);
if (!belowGoldenAfterDeath) throw new Error('Need a below-zero golden cross after the below-zero death cross for the narrated comparison');

export const crossExamples = [
  getCross('golden', 'above'),
  getCross('death', 'above'),
  belowDeath,
  belowGoldenAfterDeath,
];

const firstPeak = divergencePeaks.first;
const secondPeak = divergencePeaks.second;
if (!(candles[secondPeak].close > candles[firstPeak].close && macd[secondPeak] < macd[firstPeak])) {
  throw new Error('The selected divergence example does not meet price/MACD peak conditions');
}
for (let index = firstPositiveShrinkingRun.start; index <= firstPositiveShrinkingRun.end; index++) {
  if (!(histogram[index] > 0 && histogram[index] < histogram[index - 1])) {
    throw new Error(`The opening positive-histogram shrink example fails at candle ${index}`);
  }
}
if (!(candles[firstPositiveShrinkingRun.end].close > candles[firstPositiveShrinkingRun.start].close)) {
  throw new Error('The opening price run must continue higher overall while positive bars shrink');
}
