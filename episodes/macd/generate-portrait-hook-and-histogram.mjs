import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const segments = [
  ['01-opening', '先是一段上涨，随后价格开始回撤，MACD的绿柱也一根根变短。手里有仓位，这时候你会卖吗？关键要看回撤之后，价格能不能重新走强。'],
  ['05-histogram', '回到开头这段走势：上涨之后，价格出现回撤，正柱一根根变短，快线和信号线之间的距离也在收窄。接着看，价格强势反弹，正柱重新放大，动能也跟着恢复。柱体变短不是卖出指令，关键看回撤后价格有没有重新走强。'],
];
const tempDir = resolve('/tmp/macd-portrait-hook-histogram');
const outputDir = resolve('public/episodes/macd/voiceover-portrait');
const captionDir = resolve('episodes/macd/captions');
const edgeTts = process.env.EDGE_TTS_BIN ?? '/tmp/supertrend-edge-tts/bin/edge-tts';
mkdirSync(tempDir, {recursive: true});
mkdirSync(outputDir, {recursive: true});

const toMilliseconds = (value) => {
  const [hours, minutes, remainder] = value.split(':');
  const [seconds, millis] = remainder.split(',');
  return Number(hours) * 3600000 + Number(minutes) * 60000 + Number(seconds) * 1000 + Number(millis);
};
const durations = JSON.parse(readFileSync(resolve('episodes/macd/portrait-durations.json'), 'utf8'));
for (const [id, text] of segments) {
  const mp3 = resolve(tempDir, `${id}.mp3`);
  const srt = resolve(tempDir, `${id}.srt`);
  const wav = resolve(outputDir, `${id}.wav`);
  const speech = spawnSync(edgeTts, ['--voice', 'zh-CN-XiaoxiaoNeural', '--rate=+12%', '--text', text.replaceAll('MACD', 'M A C D'), '--write-media', mp3, '--write-subtitles', srt], {stdio: 'inherit'});
  if (speech.status !== 0) throw new Error(`Edge TTS failed for ${id}: ${speech.error ?? speech.status}`);
  const convert = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav], {stdio: 'inherit'});
  if (convert.status !== 0) throw new Error(`ffmpeg conversion failed for ${id}: ${convert.error ?? convert.status}`);
  durations[id] = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], {encoding: 'utf8'}).trim());
  const cues = readFileSync(srt, 'utf8').trim().split(/\n\s*\n/).filter(Boolean).map((block) => {
    const lines = block.split(/\r?\n/);
    const [start, end] = lines[1].split(' --> ');
    const cueText = lines.slice(2).join(' ').replaceAll('M A C D', 'MACD').trim();
    const startMs = toMilliseconds(start);
    const endMs = toMilliseconds(end);
    return {text: cueText, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: null};
  });
  writeFileSync(resolve(captionDir, `${id}-portrait.json`), `${JSON.stringify(cues, null, 2)}\n`);
  process.stdout.write(`${id}: ${durations[id].toFixed(2)}s\n`);
}
writeFileSync(resolve('episodes/macd/portrait-durations.json'), `${JSON.stringify(durations, null, 2)}\n`);
