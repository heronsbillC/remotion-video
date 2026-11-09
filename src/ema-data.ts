import daily from '../episodes/ema/data/btcusdt-bybit-1d.json';
import hourly from '../episodes/ema/data/avausdt-bybit-1h.json';
import weekly from '../episodes/ema/data/btcusdt-bybit-1w.json';
import type {Candle} from './supertrend-data';

export type EmaSeries = {
  candles: Candle[];
  timestamps: number[];
  ema7: number[];
  ema25: number[];
  ema99: number[];
  timeframe: '日线' | '1小时' | '周线';
};

type TimedCandle = {timestamp: number; open: number; high: number; low: number; close: number};

const createSeries = (source: TimedCandle[], timeframe: EmaSeries['timeframe']): EmaSeries => {
  const calculateEMA = (period: number) => {
    const alpha = 2 / (period + 1);
    let previous: number | null = null;
    return source.map(({close}) => {
      previous = previous === null ? close : close * alpha + previous * (1 - alpha);
      return previous;
    });
  };

  return {
    candles: source.map(({open, high, low, close}) => ({open, high, low, close})),
    timestamps: source.map(({timestamp}) => timestamp),
    ema7: calculateEMA(7),
    ema25: calculateEMA(25),
    ema99: calculateEMA(99),
    timeframe,
  };
};

const windowOf = (series: EmaSeries, start: number, end: number): EmaSeries => ({
  candles: series.candles.slice(start, end + 1),
  timestamps: series.timestamps.slice(start, end + 1),
  ema7: series.ema7.slice(start, end + 1),
  ema25: series.ema25.slice(start, end + 1),
  ema99: series.ema99.slice(start, end + 1),
  timeframe: series.timeframe,
});

const atOrAfter = (series: EmaSeries, timestamp: string) => (
  series.timestamps.findIndex((value) => value >= Date.parse(timestamp))
);

const dailySeries = createSeries(daily.candles, '日线');
const hourlySeries = createSeries(hourly.candles, '1小时');
const weeklySeries = createSeries(weekly.candles, '周线');

// Main trend/deviation examples: all daily bars from Aug 3 to the latest closed day.
const mainStart = atOrAfter(dailySeries, '2026-08-03T00:00:00Z');
const mainEnd = dailySeries.candles.length - 1;
const firstRallyStart = atOrAfter(dailySeries, '2026-08-17T00:00:00Z');
const firstDeviationPeak = atOrAfter(dailySeries, '2026-08-21T00:00:00Z');
const secondDeviationPeak = atOrAfter(dailySeries, '2026-09-21T00:00:00Z');
export const emaDirectionSeries = windowOf(dailySeries, mainStart, mainEnd);
export const emaDeviationSeries = emaDirectionSeries;

// Hourly support example begins at 03:00 China time on Oct 17; earlier bars
// are retained only for warming up the EMA calculations.
const supportStart = atOrAfter(hourlySeries, '2026-10-16T19:00:00Z');
export const emaSupportSeries = windowOf(hourlySeries, supportStart, hourlySeries.candles.length - 1);

// Display the last 52 completed weekly candles; earlier weeks warm up EMA values.
const resistanceStart = atOrAfter(weeklySeries, '2025-10-20T00:00:00Z');
export const emaResistanceSeries = windowOf(weeklySeries, resistanceStart, weeklySeries.candles.length - 1);

export const deviationFocusIndices = [firstDeviationPeak - mainStart, secondDeviationPeak - mainStart];
export const directionMarkers = [
  {index: firstRallyStart - mainStart, label: '第一波上涨启动', color: '#37d6a2'},
  {index: atOrAfter(dailySeries, '2026-08-30T00:00:00Z') - mainStart, label: '首次回调跌回 EMA7 下', color: '#ffd166'},
  {index: atOrAfter(dailySeries, '2026-10-08T00:00:00Z') - mainStart, label: 'EMA25 转平，价格跌破', color: '#ff637a'},
];
export const deviationMarkers = [
  {index: deviationFocusIndices[0], label: '第一波乖离最明显', color: '#ffd166'},
  {index: deviationFocusIndices[1], label: '第二波再次拉开', color: '#37d6a2'},
  {index: atOrAfter(dailySeries, '2026-09-28T00:00:00Z') - mainStart, label: '回落跌回 EMA7 下方', color: '#ff637a'},
  {index: atOrAfter(dailySeries, '2026-10-08T00:00:00Z') - mainStart, label: '后续跌破 EMA25', color: '#5db5ff'},
];

const supportTest = atOrAfter(hourlySeries, '2026-10-17T04:00:00Z');
const supportContinuation = atOrAfter(hourlySeries, '2026-10-17T19:00:00Z');
export const supportMarkers = [
  {index: supportTest - supportStart, label: '回撤靠近上行 EMA25', color: '#ffd166'},
  {index: supportContinuation - supportStart, label: '随后价格继续走高', color: '#37d6a2'},
];

const resistanceTest = atOrAfter(weeklySeries, '2026-05-04T00:00:00Z');
const resistanceContinuation = atOrAfter(weeklySeries, '2026-05-11T00:00:00Z');
export const resistanceMarkers = [
  {index: resistanceTest - resistanceStart, label: '反弹接近下行 EMA99', color: '#ff637a'},
  {index: resistanceContinuation - resistanceStart, label: '随后低点继续下移', color: '#b59cff'},
];

export const getDeviationPercent = (series: EmaSeries, index: number) => (
  ((series.candles[index].close - series.ema7[index]) / series.ema7[index]) * 100
);
