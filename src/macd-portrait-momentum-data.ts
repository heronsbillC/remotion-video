import type {Candle} from './macd-data';

// Same construction method as the approved Supertrend charts: an intentional
// market path, then irregular two-sided texture and varied intrabar wicks.
// This file is only the hook/histogram case, not a universal portrait chart.
const openingAnchors = [
  90, 96, 93, 101, 98, 106, 103, 112, 109, 117, 114, 121,
  118, 123, 120, 125, 121, 126, 122, 124, 120, 122, 118, 116,
  112, 108, 110, 106, 103, 107, 112, 109, 116, 113, 120, 117,
  125, 122, 130, 126, 132, 128,
];

const seededNoise = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

const closePrices = Array.from({length: 100}, (_, index) => {
  const scaled = (index / 99) * (openingAnchors.length - 1);
  const left = Math.floor(scaled);
  const ratio = scaled - left;
  const base = openingAnchors[left] + ((openingAnchors[Math.min(left + 1, openingAnchors.length - 1)] - openingAnchors[left]) * ratio);
  const inDeepPullback = index > 40 && index < 58;
  const volatility = inDeepPullback ? 0.9 : 1.15;
  return base
    + Math.sin(index * 1.37) * volatility * 0.55
    + Math.sin(index * 0.43) * volatility * 0.42
    + Math.sin(index * 2.31) * volatility * 0.2
    + seededNoise(index, 7) * 1.05;
});

export const portraitMomentumCandles: Candle[] = closePrices.map((close, index) => {
  const previous = closePrices[Math.max(0, index - 1)];
  const gap = Math.sin(index * 2.11) * 0.4 + Math.sin(index * 0.77) * 0.18 + seededNoise(index, 13) * 0.35;
  const open = index === 0 ? close - 0.35 : previous + gap;
  const inDeepPullback = index > 40 && index < 58;
  const wick = inDeepPullback
    ? 1.25 + (index % 4) * 0.38
    : 0.95 + (index % 4) * 0.37 + Math.abs(seededNoise(index, 29)) * 0.35;
  return {
    open,
    high: Math.max(open, close) + wick,
    low: Math.min(open, close) - wick * (0.9 + (index % 2) * 0.12),
    close,
  };
});

const ema = (values: number[], period: number) => {
  const alpha = 2 / (period + 1);
  let previous = values[0];
  return values.map((value, index) => {
    previous = index === 0 ? value : value * alpha + previous * (1 - alpha);
    return previous;
  });
};

const closes = portraitMomentumCandles.map(({close}) => close);
const fastEma = ema(closes, 12);
const slowEma = ema(closes, 26);
const macd = fastEma.map((value, index) => value - slowEma[index]);
const signal = ema(macd, 9);
const histogram = macd.map((value, index) => value - signal[index]);

export const portraitMomentumSeries = {candles: portraitMomentumCandles, fastEma, slowEma, macd, signal, histogram};
export const shrinkingBars = {start: 23, end: 26};
export const openingFocusRange = {start: shrinkingBars.start, end: shrinkingBars.end};
export const expandingBars = {start: 72, end: 76};
export const redExpandingBars = {start: 52, end: 55};

if (portraitMomentumCandles.length !== 100) throw new Error('The hook case needs 100 candles');
const upBodies = portraitMomentumCandles.filter(({open, close}) => close >= open).length;
const downBodies = portraitMomentumCandles.length - upBodies;
if (upBodies < 28 || downBodies < 28) throw new Error('The hook case needs natural two-sided candles');
for (let index = shrinkingBars.start; index <= shrinkingBars.end; index++) {
  if (!(histogram[index] > 0 && histogram[index] < histogram[index - 1])) throw new Error(`Green-bar contraction fails at ${index}`);
}
for (let index = expandingBars.start + 1; index <= expandingBars.end; index++) {
  if (!(histogram[index] > 0 && histogram[index] > histogram[index - 1])) throw new Error(`Positive-bar expansion fails at ${index}`);
}
for (let index = redExpandingBars.start; index <= redExpandingBars.end; index++) {
  if (!(histogram[index] < 0 && Math.abs(histogram[index]) > Math.abs(histogram[index - 1]))) throw new Error(`Negative-bar expansion fails at ${index}`);
}
if (!(closes[26] > closes[20] && closes[60] < closes[40] * 0.91 && closes[76] > closes[65])) {
  throw new Error('The hook case must show strength fading, a real pullback, then recovery');
}
