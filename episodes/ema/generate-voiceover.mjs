import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';

const outputDir = resolve('public/episodes/ema/voiceover');
const tempDir = resolve('/tmp/ema-edge-tts-output');
const edgeTts = process.env.EDGE_TTS_BIN ?? '/tmp/supertrend-edge-tts/bin/edge-tts';
const voice = 'zh-CN-XiaoxiaoNeural';

mkdirSync(outputDir, {recursive: true});
mkdirSync(tempDir, {recursive: true});

const scenes = [
  ['01-opening', '如果图表上只能留一个指标，我会留EMA。不是因为它能告诉你明天涨还是跌，而是因为它能帮你把三个问题看清楚：趋势往哪边走？价格是不是离得太远？回调到关键位置后，价格有没有转强？'],
  ['02-direction', '先说第一个作用：看趋势方向。用 7、25、99，分别看短、中、长周期。价格从回踩后走出一段上涨，短期线先抬起，25 和 99 随后跟上。冲高后，价格先跌回短期EMA下方，短期走弱；但中期EMA还在上行，不能因为短线回落就说中期转弱。再看右边，价格继续下探，中期EMA由上行转平，再向下；价格收在它下方，中期走势也开始转弱。长期EMA仍向上，变化最慢，提供更长周期的背景。短线看变化，中线看确认，长线看方向。'],
  ['03-deviation', '第二个作用：看乖离。先看左边第一波急涨，收盘价一度比EMA7高出百分之十一点九，价格和均线明显拉开。右边后来又冲了一次，乖离也有百分之六点七左右。两次加速都说明短线跑得很快；还没进场的，别只因为涨得快就追。乖离偏大，价格可能向均值回归；已经持仓，可以考虑分批止盈一部分。再看后面，价格先跌回EMA7下方，继续回落后又跌破EMA25。接下来要看价格能不能企稳、重新站上EMA25；如果始终站不回去，回落还可能继续。'],
  ['04-support-resistance', '第三个作用：看均线附近，价格怎样反应。先看这段回调。价格回落到上行的EMA25附近，一度下探，收盘重新回到线附近，随后继续走高。为什么会有买盘？持仓的人看到均线附近守住，可能继续持有或加仓；等回调的人也可能把这里当作关注区域。买盘在均线附近接住卖盘，价格随后走高，支撑就来自这轮真实的买卖反应。再看另一个例子。下行过程中，价格反弹到向下的EMA99附近，但收盘仍在线下。为什么这里会有卖压？上方买入的人等价格反弹回来，可能选择离场；看空的人也可能趁反弹卖出。卖盘把价格压回均线下，之后低点继续下移，均线附近就形成了阻力。'],
  ['05-close', '所以，EMA不只是看价格在线上还是线下。看方向，观察短中长周期的变化；乖离过大时，留意均值回归，持仓可以考虑部分止盈；看支撑阻力，观察价格回到均线附近后的买卖反应。用EMA，不是预测下一步，而是等价格走出来，再做确认。'],
];

const requestedScenes = new Set(process.argv.slice(2));
for (const [id, text] of scenes) {
  if (requestedScenes.size > 0 && !requestedScenes.has(id)) continue;
  const mp3 = resolve(tempDir, `${id}.mp3`);
  const wav = resolve(outputDir, `${id}.wav`);
  // Separate the English initialisms so the Chinese voice says the letter names,
  // rather than attempting to pronounce “EMA” as a single word.
  const spokenText = text.replaceAll('EMA', 'E M A');
  const speech = spawnSync(edgeTts, ['--voice', voice, '--rate=-4%', '--text', spokenText, '--write-media', mp3], {stdio: 'inherit'});
  if (speech.status !== 0) throw new Error(`Edge TTS failed for ${id}: ${speech.error ?? speech.status}`);
  const convert = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav], {stdio: 'inherit'});
  if (convert.status !== 0) throw new Error(`ffmpeg conversion failed for ${id}: ${convert.error ?? convert.status}`);
  const duration = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], {encoding: 'utf8'}).trim();
  rmSync(mp3, {force: true});
  process.stdout.write(`${id}: ${duration}s\n`);
}
