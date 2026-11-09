import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const outputDir = resolve('public/episodes/macd/voiceover');
const captionDir = resolve('episodes/macd/captions');
const tempDir = resolve('/tmp/macd-edge-tts-output');
const edgeTts = process.env.EDGE_TTS_BIN ?? '/tmp/supertrend-edge-tts/bin/edge-tts';
const voice = 'zh-CN-XiaoxiaoNeural';
const rate = process.env.MACD_TTS_RATE ?? '+12%';

mkdirSync(outputDir, {recursive: true});
mkdirSync(captionDir, {recursive: true});
mkdirSync(tempDir, {recursive: true});

const scenes = [
  ['01-opening', '手里的行情还在涨，MACD柱子却一根比一根短——现在该不该卖？先别急着下结论。柱子变短是在提醒你动能变化，但它不是单独的卖出信号。'],
  ['02-components', 'MACD主要看三样：快线、信号线和柱体。快线是短期均线减去长期均线；信号线是快线的平滑线；柱体显示快线和信号线之间的距离。它们不是三种不同的买卖答案，而是从不同角度观察价格动能。'],
  ['03-zero-line', '先看零轴。快线在零轴上方，说明短期均线高于长期均线，MACD处在偏多背景；快线在零轴下方，说明短期均线低于长期均线，处在偏空背景。零轴先定多空背景。'],
  ['04-crossovers', '再看快线和信号线的交叉。偏多背景里，快线上穿，常见于回调后的动能恢复；下穿，可能是上涨放慢，也可能只是阶段性回落。偏空背景里，下穿更偏向弱势延续；上穿则可能只是反弹。同样的金叉或死叉，出现在零轴上下，含义可能不同。'],
  ['05-histogram', '回到开头：价格还在涨，正柱却一根根缩短，说明快线和信号线的距离正在收窄，上行动能可能减弱了。它提醒你留意走势变化，但价格可能继续上涨；如果柱体重新放大，动能也可能再次增强。'],
  ['06-divergence', '如果价格高点越来越高，MACD高点却越来越低，就是顶背离。它说明价格创新高时，动能没有同步增强，是一个需要留意的信号；但背离可能持续，要继续观察价格有没有走弱。'],
  ['07-close', '所以，别看到柱子变短就急着卖。先看零轴判断偏多还是偏空，再看交叉和柱体变化，最后回到价格，确认走势有没有真的转弱。'],
];

const durations = {};
for (const [id, text] of scenes) {
  const mp3 = resolve(tempDir, `${id}.mp3`);
  const srt = resolve(tempDir, `${id}.srt`);
  const wav = resolve(outputDir, `${id}.wav`);
  // Spell the English acronym as individual letter names, preserving the approved voice.
  const spokenText = text.replaceAll('MACD', 'M A C D');
  const speech = spawnSync(edgeTts, ['--voice', voice, `--rate=${rate}`, '--text', spokenText, '--write-media', mp3, '--write-subtitles', srt], {stdio: 'inherit'});
  if (speech.status !== 0) throw new Error(`Edge TTS failed for ${id}: ${speech.error ?? speech.status}`);
  const convert = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav], {stdio: 'inherit'});
  if (convert.status !== 0) throw new Error(`ffmpeg conversion failed for ${id}: ${convert.error ?? convert.status}`);
  const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], {encoding: 'utf8'}).trim());
  durations[id] = duration;
  const toMilliseconds = (value) => {
    const [hours, minutes, remainder] = value.split(':');
    const [seconds, millis] = remainder.split(',');
    return Number(hours) * 3600000 + Number(minutes) * 60000 + Number(seconds) * 1000 + Number(millis);
  };
  const cues = readFileSync(srt, 'utf8').trim().split(/\n\s*\n/).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/);
    const [start, end] = lines[1].split(' --> ');
    const text = lines.slice(2).join(' ').replaceAll('M A C D', 'MACD').trim();
    const startMs = toMilliseconds(start);
    const endMs = toMilliseconds(end);
    return {text, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: null};
  });
  writeFileSync(resolve(captionDir, `${id}.json`), `${JSON.stringify(cues, null, 2)}\n`);
  process.stdout.write(`${id}: ${duration.toFixed(2)}s (${rate})\n`);
}

writeFileSync(resolve('episodes/macd/durations.json'), `${JSON.stringify(durations, null, 2)}\n`);
process.stdout.write(`Total narration: ${Object.values(durations).reduce((sum, value) => sum + value, 0).toFixed(2)}s\n`);
