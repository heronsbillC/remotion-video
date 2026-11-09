import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

// Mirrors market/data.go:GetKlinesFromBybitRange for BTCUSDT linear 4-hour candles.
const url = new URL('https://api.bybit.com/v5/market/kline');
url.search = new URLSearchParams({category: 'linear', symbol: 'BTCUSDT', interval: '240', limit: '1000'}).toString();
const response = await fetch(url);
if (!response.ok) throw new Error(`Bybit HTTP ${response.status}`);
const payload = await response.json();
if (payload.retCode !== 0) throw new Error(`Bybit error ${payload.retCode}: ${payload.retMsg}`);

// Bybit returns newest-first; data.go reverses it to chronological order.
const candles = payload.result.list.reverse().map(([timestamp, open, high, low, close, volume, turnover]) => ({
  timestamp: Number(timestamp),
  open: Number(open),
  high: Number(high),
  low: Number(low),
  close: Number(close),
  volume: Number(volume),
  turnover: Number(turnover),
})).filter(({timestamp}) => timestamp + (4 * 60 * 60 * 1000) <= Date.now());
if (candles.length < 250) throw new Error(`Expected at least 250 candles, got ${candles.length}`);

const output = resolve('episodes/ema/data/btcusdt-bybit-4h.json');
mkdirSync(dirname(output), {recursive: true});
writeFileSync(output, `${JSON.stringify({source: 'Bybit V5 linear BTCUSDT 4-hour klines', fetchedAt: new Date().toISOString(), candles}, null, 2)}\n`);
process.stdout.write(`Saved ${candles.length} chronological BTCUSDT 4-hour candles (${new Date(candles[0].timestamp).toISOString().slice(0, 10)} to ${new Date(candles.at(-1).timestamp).toISOString().slice(0, 10)}) to ${output}\n`);
