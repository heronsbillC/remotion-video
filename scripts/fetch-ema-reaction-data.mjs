import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const outputDir = resolve('episodes/ema/data');
const now = Date.now();
const hour = 60 * 60 * 1000;
const week = 7 * 24 * hour;

const fetchKlines = async ({symbol, interval, start}) => {
  const url = new URL('https://api.bybit.com/v5/market/kline');
  for (const [key, value] of Object.entries({
    category: 'linear',
    symbol,
    interval,
    limit: '1000',
    start: String(start),
  })) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bybit returned HTTP ${response.status} for ${symbol} ${interval}`);
  const payload = await response.json();
  if (payload.retCode !== 0) throw new Error(`Bybit API error for ${symbol} ${interval}: ${payload.retMsg}`);

  return payload.result.list
    .map(([timestamp, open, high, low, close, volume, turnover]) => ({
      timestamp: Number(timestamp),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume),
      turnover: Number(turnover),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
};

const save = (filename, source, interval, candles) => {
  if (candles.length === 0) throw new Error(`No closed candles returned for ${filename}`);
  mkdirSync(outputDir, {recursive: true});
  writeFileSync(resolve(outputDir, filename), `${JSON.stringify({source, interval, fetchedAt: new Date(now).toISOString(), candles}, null, 2)}\n`);
  process.stdout.write(`${filename}: ${candles.length} candles, ${new Date(candles[0].timestamp).toISOString()} to ${new Date(candles.at(-1).timestamp).toISOString()}\n`);
};

const avaWarmup = await fetchKlines({
  symbol: 'AVAUSDT',
  interval: '60',
  start: Date.parse('2026-10-11T16:00:00Z'),
});
save(
  'avausdt-bybit-1h.json',
  'Bybit V5 linear AVAUSDT hourly candles; chart begins 2026-10-16 19:00 UTC (2026-10-17 03:00 Asia/Shanghai)',
  '1h',
  avaWarmup.filter(({timestamp}) => timestamp >= Date.parse('2026-10-11T16:00:00Z') && timestamp + hour <= now),
);

const btcWarmup = await fetchKlines({
  symbol: 'BTCUSDT',
  interval: 'W',
  start: Date.parse('2023-10-19T16:00:00Z'),
});
save(
  'btcusdt-bybit-1w.json',
  'Bybit V5 linear BTCUSDT weekly candles; current incomplete week excluded',
  '1w',
  btcWarmup.filter(({timestamp}) => timestamp + week <= now),
);
