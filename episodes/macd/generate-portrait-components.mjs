import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const text = 'MACD主要看三样：快线、信号线和柱体。快线，是短期均线减去长期均线；信号线，是快线再做一次平滑；柱体，则把快线和信号线之间的距离画出来。';
const tempDir = resolve('/tmp/macd-portrait-components');
const outputDir = resolve('public/episodes/macd/voiceover-portrait');
const edgeTts = process.env.EDGE_TTS_BIN ?? '/tmp/supertrend-edge-tts/bin/edge-tts';
mkdirSync(tempDir, {recursive: true});
mkdirSync(outputDir, {recursive: true});

const mp3 = resolve(tempDir, '02-components.mp3');
const srt = resolve(tempDir, '02-components.srt');
const wav = resolve(outputDir, '02-components.wav');
const speech = spawnSync(edgeTts, ['--voice', 'zh-CN-XiaoxiaoNeural', '--rate=+12%', '--text', text.replaceAll('MACD', 'M A C D'), '--write-media', mp3, '--write-subtitles', srt], {stdio: 'inherit'});
if (speech.status !== 0) throw new Error(`Edge TTS failed: ${speech.error ?? speech.status}`);
const convert = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', wav], {stdio: 'inherit'});
if (convert.status !== 0) throw new Error(`ffmpeg conversion failed: ${convert.error ?? convert.status}`);
const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', wav], {encoding: 'utf8'}).trim());
const toMilliseconds = (value) => {
  const [hours, minutes, remainder] = value.split(':');
  const [seconds, millis] = remainder.split(',');
  return Number(hours) * 3600000 + Number(minutes) * 60000 + Number(seconds) * 1000 + Number(millis);
};
const cues = readFileSync(srt, 'utf8').trim().split(/\n\s*\n/).filter(Boolean).map((block) => {
  const lines = block.split(/\r?\n/);
  const [start, end] = lines[1].split(' --> ');
  const cueText = lines.slice(2).join(' ').replaceAll('M A C D', 'MACD').trim();
  const startMs = toMilliseconds(start);
  const endMs = toMilliseconds(end);
  return {text: cueText, startMs, endMs, timestampMs: Math.round((startMs + endMs) / 2), confidence: null};
});
writeFileSync(resolve('episodes/macd/captions/02-components-portrait.json'), `${JSON.stringify(cues, null, 2)}\n`);
writeFileSync(resolve('episodes/macd/portrait-durations.json'), `${JSON.stringify({'02-components': duration}, null, 2)}\n`);
process.stdout.write(`Portrait components narration: ${duration.toFixed(2)}s\n`);
