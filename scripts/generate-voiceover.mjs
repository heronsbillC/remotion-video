import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const outputDir = resolve('public/voiceover-xiaoxiao');
const tempDir = resolve('/tmp/supertrend-edge-tts-output');
const edgeTts = process.env.EDGE_TTS_BIN ?? 'edge-tts';
const voice = 'zh-CN-XiaoxiaoNeural';
mkdirSync(outputDir, {recursive: true});
mkdirSync(tempDir, {recursive: true});

const scenes = [
  ['01-opening', '股票涨着涨着，突然回撤。你会被一根大阴线吓下车，还是继续拿？关键是：怎么判断趋势真的变了？'],
  ['02-role', 'Supertrend给你一条会随波动移动的趋势线：涨时通常在价格下方，跌时通常在上方。'],
  ['03-atr', '它的宽窄来自ATR——近期价格通常晃多大。波动放大，边界留宽些；波动收敛，边界靠近。ATR量波动，不分涨跌方向。'],
  ['04-flip', '上涨时，线在价格下方；只要收盘没跌破它，趋势状态就延续。收盘跌破，Supertrend翻到上方。下跌时反过来：收盘突破上方边界，线就翻到下方。'],
  ['05-example', '回撤时别被每根阴线牵着走，先看收盘在哪边。还在趋势线的一侧，就继续观察；收盘越线、指标换边，趋势状态才确认切换。'],
  ['06-tradeoff', '代价是慢一步：等收盘确认时，拐点已经走过一段。好处是你有条边界跟踪趋势，不用每根K线都重新猜。可横盘时，价格来回穿线，信号也会反复。'],
  ['07-close', '回撤来了，先看收盘和这条线的关系。你跟趋势更愿意看Supertrend，还是看均线？'],
];

for (const [id, text] of scenes) {
  const mp3 = resolve(tempDir, `${id}.mp3`);
  const wav = resolve(outputDir, `${id}.wav`);
  const speech = spawnSync(edgeTts, ['--voice', voice, '--rate=-4%', '--text', text, '--write-media', mp3], {stdio: 'inherit'});
  if (speech.status !== 0) throw new Error(`Edge TTS failed for ${id}: ${speech.error ?? speech.status}`);
  const convert = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav], {stdio: 'inherit'});
  if (convert.status !== 0) throw new Error(`ffmpeg conversion failed for ${id}: ${convert.error ?? convert.status}`);
  const duration = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], {encoding: 'utf8'}).trim();
  rmSync(mp3, {force: true});
  process.stdout.write(`${id}: ${duration}s\n`);
}
