import type {Candle, MacdCross} from './macd-data';

// A purpose-built, deterministic teaching example for the portrait zero-line
// and crossover scenes: a clear sequence of lower highs/lows with brief,
// progressively weaker countertrend rallies.
const phases: [number, number, number, number][] = [
  [0, 14, 0.015, 0.009],
  [14, 24, 0.007, 0.006],
  [24, 29, 0.018, 0.01],
  [29, 32, -0.012, 0.012],
  [32, 36, 0.017, 0.012],
  [36, 41, 0.002, 0.012],
  [41, 55, -0.02, 0.016],
  [55, 62, 0.015, 0.014],
  [62, 68, -0.018, 0.018],
  [68, 82, 0.008, 0.014],
  [82, 100, -0.025, 0.016],
];

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const randomWalk = seededRandom(224466);
const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, randomWalk()))) * Math.cos(2 * Math.PI * randomWalk());
const closes = [100];
const countertrendCloses = new Set([5, 9, 15, 21, 27, 33, 38, 45, 51, 58, 65, 72, 78, 85, 91, 96]);
for (let index = 1; index < 100; index++) {
  const [, , phaseDrift, volatility] = phases.find(([start, end]) => index >= start && index < end)!;
  const advancing = phaseDrift > 0;
  // Real trend legs breathe. These scheduled countertrend closes remove the
  // previous continuous green/red walls while preserving the larger regime.
  const drift = phaseDrift + (countertrendCloses.has(index) ? (advancing ? -0.026 : 0.026) : 0);
  closes.push(closes[index - 1] * Math.exp(drift + volatility * gaussian() * 0.62));
}

const candleRandom = seededRandom(531957);
// Preserve the close series that produces the four verified MACD crosses, but
// make the displayed OHLC behave like the Supertrend examples: even inside a
// trend leg there are ordinary intrabar pullbacks and relief candles.
const intrabarPullbackBars = new Set([4, 8, 13, 18, 25, 28, 33, 35, 39, 55, 59, 69, 74, 78]);
const intrabarReliefBars = new Set([44, 48, 52, 57, 64, 66, 72, 76, 84, 89, 94]);
export const portraitCandles: Candle[] = closes.map((close, index) => {
  const previousClose = index === 0 ? close : closes[index - 1];
  const naturalOpen = index === 0 ? close * 0.997 : previousClose * (1 + (candleRandom() - 0.5) * 0.004);
  const open = intrabarPullbackBars.has(index)
    ? Math.max(naturalOpen, close * 1.007)
    : intrabarReliefBars.has(index)
      ? Math.min(naturalOpen, close * 0.993)
      : naturalOpen;
  const volatilityBoost = index >= 41 && index < 69 ? 1.65 : 1;
  const high = Math.max(open, close) * (1 + (0.0015 + candleRandom() * 0.006) * volatilityBoost);
  const low = Math.min(open, close) * (1 - (0.0015 + candleRandom() * 0.006) * volatilityBoost);
  return {open, high, low, close};
});

const ema = (values: number[], period: number) => {
  const alpha = 2 / (period + 1);
  let previous = values[0];
  return values.map((value, index) => {
    previous = index === 0 ? value : value * alpha + previous * (1 - alpha);
    return previous;
  });
};

const prices = portraitCandles.map(({close}) => close);
const fastEma = ema(prices, 12);
const slowEma = ema(prices, 26);
const macd = fastEma.map((value, index) => value - slowEma[index]);
const signal = ema(macd, 9);
const histogram = macd.map((value, index) => value - signal[index]);
const crosses: MacdCross[] = [];
for (let index = 1; index < macd.length; index++) {
  const previous = macd[index - 1] - signal[index - 1];
  const current = macd[index] - signal[index];
  if (previous * current < 0) {
    crosses.push({index, kind: current > 0 ? 'golden' : 'death', zone: macd[index] >= 0 ? 'above' : 'below'});
  }
}

const find = (kind: MacdCross['kind'], zone: MacdCross['zone'], after = -1) => {
  const cross = crosses.find((item) => item.kind === kind && item.zone === zone && item.index > after);
  if (!cross) throw new Error(`Missing portrait example: ${zone}-zero ${kind} cross`);
  return cross;
};

const belowDeath = find('death', 'below');
const belowGolden = find('golden', 'below', belowDeath.index);
const aboveGolden = find('golden', 'above');
const aboveDeathAfterGolden = find('death', 'above', aboveGolden.index);
export const portraitMacdSeries = {candles: portraitCandles, fastEma, slowEma, macd, signal, histogram, crosses};
export const portraitCrossExamples = [
  aboveGolden,
  aboveDeathAfterGolden,
  belowDeath,
  belowGolden,
];
export const portraitZeroExamples = {bullish: 20, bearish: 67};

const swingHigh1 = Math.max(...portraitCandles.slice(32, 41).map(({high}) => high));
const swingHigh2 = Math.max(...portraitCandles.slice(68, 82).map(({high}) => high));
const swingLow1 = Math.min(...portraitCandles.slice(41, 56).map(({low}) => low));
const swingLow3 = Math.min(...portraitCandles.slice(82).map(({low}) => low));
if (!(swingHigh1 > swingHigh2 && swingLow1 > swingLow3)) {
  throw new Error('Portrait crossover chart must show lower rebound highs and lower swing lows');
}
if (!(portraitMacdSeries.macd[portraitZeroExamples.bearish] < 0 && belowGolden.index > belowDeath.index)) {
  throw new Error('Portrait bearish examples must remain below zero and occur in order');
}
