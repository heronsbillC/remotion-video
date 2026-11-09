import type {Candle, MacdCross} from './macd-data';

export type TeachingSeries = {
  candles: Candle[];
  macd: number[];
  signal: number[];
  histogram: number[];
  crosses: MacdCross[];
};

const noise = (index: number, salt: number) => {
  const value = Math.sin((index + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

const interpolateAnchors = (anchors: number[], count: number) => Array.from({length: count}, (_, index) => {
  const scaled = (index / (count - 1)) * (anchors.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(anchors.length - 1, left + 1);
  return anchors[left] + (anchors[right] - anchors[left]) * (scaled - left);
});

const ema = (values: number[], period: number) => {
  const alpha = 2 / (period + 1);
  let previous = values[0];
  return values.map((value, index) => {
    previous = index === 0 ? value : value * alpha + previous * (1 - alpha);
    return previous;
  });
};

// Anchors define the lesson. Noise only gives the displayed candles ordinary,
// two-sided market texture; indicators are always calculated from these closes.
export const makeTeachingSeries = (anchors: number[], salt: number, count = 54): TeachingSeries => {
  const closes = interpolateAnchors(anchors, count).map((base, index) => base + noise(index, salt) * (0.75 + (index % 5) * 0.13) + Math.sin(index * 1.41 + salt) * 0.52);
  const candles: Candle[] = closes.map((close, index) => {
    const previous = closes[Math.max(0, index - 1)];
    const gap = noise(index, salt + 3) * 0.75 + Math.sin(index * 0.71 + salt) * 0.28;
    const naturalOpen = index === 0 ? close - 0.6 : previous + gap;
    // A scheduled open opposite the local close creates believable countertrend
    // bodies inside both advances and declines instead of walls of one colour.
    const open = index % 7 === 2 ? close + Math.abs(noise(index, salt + 5)) * 1.35 : index % 9 === 5 ? close - Math.abs(noise(index, salt + 7)) * 1.1 : naturalOpen;
    const upper = 0.72 + Math.abs(noise(index, salt + 11)) * 1.25 + (index % 6 === 0 ? 0.8 : 0);
    const lower = 0.68 + Math.abs(noise(index, salt + 13)) * 1.35 + (index % 5 === 0 ? 0.65 : 0);
    return {open, close, high: Math.max(open, close) + upper, low: Math.min(open, close) - lower};
  });
  const values = candles.map((item) => item.close);
  const macd = ema(values, 12).map((fast, index) => fast - ema(values, 26)[index]);
  const signal = ema(macd, 9);
  const histogram = macd.map((value, index) => value - signal[index]);
  const crosses: MacdCross[] = [];
  for (let index = 1; index < macd.length; index++) {
    const previous = macd[index - 1] - signal[index - 1];
    const current = macd[index] - signal[index];
    if (previous * current < 0) crosses.push({index, kind: current > 0 ? 'golden' : 'death', zone: macd[index] >= 0 ? 'above' : 'below'});
  }
  return {candles, macd, signal, histogram, crosses};
};

// 1) A higher price high with less positive momentum; reused only when the
// narration returns to explain the hook's shrinking histogram.
export const hookSeries = makeTeachingSeries([92, 97, 95, 102, 99, 107, 104, 112, 108, 116, 112, 118, 114, 120, 116, 121, 117, 120, 115, 110, 106, 109, 105, 111, 116, 113], 31, 52);
export const hookShrinkingBars = {start: 23, end: 25};
export const hookReexpandingBars = {start: 49, end: 51};

// 2) A clear bullish regime followed by an unmistakable bearish regime.
export const zeroSeries = makeTeachingSeries([98, 101, 99, 105, 102, 109, 106, 114, 110, 116, 112, 108, 104, 106, 101, 97, 99, 93, 89, 91, 85, 82, 84], 73, 54);

// 3) Gentle acceleration then deceleration, used solely to introduce the
// three pieces of MACD as they are drawn on screen.
export const componentsSeries = makeTeachingSeries([100, 101, 99, 103, 102, 106, 105, 110, 109, 113, 112, 114, 112, 109, 108, 105, 107], 59, 46);

// 4) An uptrend pullback and a downtrend relief rally give the four crossing
// positions visibly different price context.
export const crossSeries = makeTeachingSeries([96, 100, 98, 104, 102, 109, 106, 112, 109, 106, 108, 104, 100, 102, 98, 94, 96, 92, 89, 91, 87, 84, 86, 82], 91, 56);

// 3) Two comparable peaks: price makes the second high, MACD fails to do so.
export const divergenceSeries = makeTeachingSeries([96, 100, 98, 104, 101, 108, 104, 106, 102, 107, 105, 111, 108, 114, 110, 107, 103, 99, 101], 107, 48);

// 5) A short recap chart: the trend weakens, breaks lower, then bounces.
export const summarySeries = makeTeachingSeries([100, 104, 101, 108, 105, 111, 108, 110, 105, 99, 102, 96, 93, 96, 91, 94], 137, 44);
