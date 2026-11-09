import React from "react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Composition, Series, interpolate, staticFile, useCurrentFrame} from "remotion";
import type {Caption} from "@remotion/captions";
import voiceJson from "./regime-voice.json";

type Candle = {open: number; high: number; low: number; close: number};
type TimedCaption = Caption & {stage: number};
type VoiceScene = {durationMs: number; captions: TimedCaption[]};
type VoiceData = Record<string, VoiceScene>;
type Metric = "chop" | "ker";

const voice = voiceJson as VoiceData;
const fps = 30;
const chopCues = {
  trend: voice["chop-zones"].captions[2].startMs / 1000,
  // Static narration cue from generated JSON; not a time-based runtime source.
  // eslint-disable-next-line @remotion/non-pure-animation
  transition: voice["chop-zones"].captions[4].startMs / 1000,
  rangeToTransition: voice["chop-zones"].captions[7].startMs / 1000,
  trendToTransition: voice["chop-zones"].captions[9].startMs / 1000,
};
const kerCues = {
  chaos: voice["ker-zones"].captions[2].startMs / 1000,
  weak: voice["ker-zones"].captions[4].startMs / 1000,
  strong: voice["ker-zones"].captions[6].startMs / 1000,
};
const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const C = {bg: "#07111c", panel: "#0b1623", grid: "#283748", text: "#eef5fa", muted: "#91a7b9", green: "#13b99a", red: "#f0445e", blue: "#2f9cff", gold: "#ffc857"};

// A deterministic market path: range → directional advance with pullbacks → fading trend.
// Opens stay near the previous close and wick/body sizes vary, so this reads as price action.
const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};
const random = seededRandom(203311);
const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) * Math.cos(2 * Math.PI * random());
const closes = [100];
for (let index = 1; index < 100; index++) {
  const range = index < 36;
  const advancing = index >= 36 && index < 72;
  const drift = range ? (index % 5 === 0 ? 0.007 : -0.001) : advancing ? ([42, 49, 57, 64].includes(index) ? -0.011 : 0.009) : (index % 4 === 0 ? 0.007 : -0.003);
  const volatility = range || !advancing ? 0.011 : 0.006;
  closes.push(closes[index - 1] * Math.exp(drift + volatility * gaussian() * 0.62));
}
const candleRandom = seededRandom(799);
const candles: Candle[] = closes.map((close, index) => {
  const previous = closes[Math.max(0, index - 1)];
  const open = index === 0 ? close * 0.996 : previous * (1 + (candleRandom() - 0.5) * 0.004);
  const boost = index < 36 || index >= 72 ? 1.4 : 1;
  const upper = (0.002 + candleRandom() * 0.006) * boost;
  const lower = (0.002 + candleRandom() * 0.006) * boost;
  return {open, close, high: Math.max(open, close) * (1 + upper), low: Math.min(open, close) * (1 - lower)};
});

const chopAt = (index: number, period = 14) => {
  if (index < period) return null;
  let sum = 0;
  for (let current = index - period + 1; current <= index; current++) {
    const candle = candles[current];
    const previous = candles[current - 1].close;
    sum += Math.max(candle.high - candle.low, Math.abs(candle.high - previous), Math.abs(candle.low - previous));
  }
  const window = candles.slice(index - period + 1, index + 1);
  const high = Math.max(...window.map((candle) => candle.high));
  const low = Math.min(...window.map((candle) => candle.low));
  return 100 * Math.log10(sum / (high - low)) / Math.log10(period);
};
const kerAt = (index: number, period = 14) => {
  if (index < period) return null;
  const start = index - period;
  const displacement = Math.abs(candles[index].close - candles[start].close);
  let path = 0;
  for (let current = start + 1; current <= index; current++) path += Math.abs(candles[current].close - candles[current - 1].close);
  return displacement / path;
};
const chop = candles.map((_, index) => chopAt(index));
const ker = candles.map((_, index) => kerAt(index));
const points = {range: 35, highToTransition: 45, trend: 60, fade: 78, kerRange: 25, kerChaos: 27, kerForming: 45, kerTrend: 55};
if (!(chop[points.range]! > 61.8 && chop[points.highToTransition]! > 38.2 && chop[points.highToTransition]! < 61.8 && chop[points.trend]! < 38.2 && chop[points.fade]! > 38.2 && chop[points.fade]! < 61.8)) throw new Error("CHOP threshold examples are invalid");
if (!(ker[points.kerRange]! <= 0.15 && ker[points.kerChaos]! > 0.15 && ker[points.kerChaos]! <= 0.3 && ker[points.kerForming]! > 0.3 && ker[points.kerForming]! <= 0.7 && ker[points.kerTrend]! > 0.7)) throw new Error("KER threshold examples are invalid");

const visible = (frame: number, start = 8, duration = 10) => interpolate(frame, [start, start + duration], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
const at = (values: Array<number | null>, index: number) => values[index] ?? 0;

type Highlight = {from: number; to: number; label: string; color: string};
const TradingChart: React.FC<{metric: Metric; focus: number; start: number; end: number; headline: string; detail: string; teach?: Metric; highlight?: Highlight}> = ({metric, focus, start, end, headline, detail, teach, highlight}) => {
  const frame = useCurrentFrame();
  const w = 970, h = 1080, left = 52, right = 42, priceTop = 126, priceBottom = 590, indicatorTop = 675, indicatorBottom = 1002;
  const view = candles.slice(start, end + 1);
  const x = (index: number) => left + ((index - start) / Math.max(1, end - start)) * (w - left - right);
  const low = Math.min(...view.map((candle) => candle.low));
  const high = Math.max(...view.map((candle) => candle.high));
  const pricePad = (high - low) * .1;
  const priceY = (number: number) => priceBottom - ((number - (low - pricePad)) / (high - low + pricePad * 2)) * (priceBottom - priceTop);
  const values = metric === "chop" ? chop : ker;
  const max = metric === "chop" ? 100 : 1;
  const indicatorY = (number: number) => indicatorBottom - (number / max) * (indicatorBottom - indicatorTop);
  const step = (w - left - right) / Math.max(1, end - start);
  const focusValue = at(values, focus);
  const state = metric === "chop"
    ? focusValue > 61.8 ? {text: "震荡行情", color: C.red} : focusValue < 38.2 ? {text: "趋势更明确", color: C.green} : {text: "黄色区域", color: C.gold}
    : focusValue <= .15 ? {text: "箱体震荡", color: C.red} : focusValue <= .3 ? {text: "混沌/不明朗", color: C.gold} : focusValue <= .7 ? {text: "弱趋势", color: C.blue} : {text: "强趋势", color: C.green};
  const thresholds = metric === "chop" ? [61.8, 38.2] : [.7, .3, .15];
  const line = values.slice(start, end + 1).map((item, offset) => item === null ? "" : `${offset === 0 || values[start + offset - 1] === null ? "M" : "L"} ${x(start + offset).toFixed(1)} ${indicatorY(item).toFixed(1)}`).filter(Boolean).join(" ");
  const opacity = visible(frame);
  const badgeX = Math.min(w - right - 138, Math.max(left, x(focus) - 69));
  const badgeY = Math.max(indicatorTop + 9, indicatorY(focusValue) - 67);
  const teachStart = Math.max(start, focus - 13);
  const teachCandles = candles.slice(teachStart, focus + 1);
  const teachHigh = Math.max(...teachCandles.map((candle) => candle.high));
  const teachLow = Math.min(...teachCandles.map((candle) => candle.low));
  const teachProgress = interpolate(frame, [42, 210], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const formulaOpacity = visible(frame, 18, 14);
  const directProgress = interpolate(frame, [145, 220], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const highlightProgress = interpolate(frame, [20, 85], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  const highlightCandles = highlight ? candles.slice(highlight.from, highlight.to + 1) : [];
  const highlightHigh = highlightCandles.length ? Math.max(...highlightCandles.map((candle) => candle.high)) : 0;
  const highlightLow = highlightCandles.length ? Math.min(...highlightCandles.map((candle) => candle.low)) : 0;
  const highlightValues = highlight ? values.slice(highlight.from, highlight.to + 1) : [];
  const highlightPath = highlight && highlightValues.length ? highlightValues.map((item, offset) => item === null ? "" : `${offset === 0 || highlightValues[offset - 1] === null ? "M" : "L"} ${x(highlight.from + offset).toFixed(1)} ${indicatorY(item).toFixed(1)}`).filter(Boolean).join(" ") : "";
  return <svg viewBox={`0 0 ${w} ${h}`} style={{width: "100%", display: "block"}}>
    <rect width={w} height={h} rx="26" fill={C.panel} stroke="#243648" strokeWidth="2" />
    <text x={left} y="42" fill={C.text} fontSize="28" fontWeight="820" fontFamily={font}>{headline}</text>
    <text x={w - right} y="42" textAnchor="end" fill={state.color} fontSize="24" fontWeight="780" fontFamily={font}>{detail}</text>
    {teach && <g opacity={formulaOpacity}><rect x={left} y="58" width={w - left - right} height="45" rx="12" fill="#10263a" stroke={teach === "chop" ? C.gold : C.blue} strokeWidth="1.5" /><text x={w / 2} y="88" textAnchor="middle" fill={C.text} fontFamily={font} fontWeight="730" fontSize="19">{teach === "chop" ? "CHOP = log₁₀(ΣTR ÷ (最高价 − 最低价)) ÷ log₁₀(14) × 100" : "KER = |当前收盘 − 14 根前收盘| ÷ Σ|每根收盘变化|"}</text></g>}
    {[0, 1, 2, 3, 4].map((lineIndex) => <line key={`h-${lineIndex}`} x1={left} x2={w - right} y1={priceTop + (priceBottom - priceTop) * lineIndex / 4} y2={priceTop + (priceBottom - priceTop) * lineIndex / 4} stroke={C.grid} opacity=".78" />)}
    {[0, .25, .5, .75, 1].map((fraction) => <line key={`v-${fraction}`} x1={left + (w - left - right) * fraction} x2={left + (w - left - right) * fraction} y1={priceTop} y2={indicatorBottom} stroke={C.grid} opacity=".53" />)}
    {view.map((candle, offset) => { const index = start + offset; const up = candle.close >= candle.open; const color = up ? C.green : C.red; const top = priceY(Math.max(candle.open, candle.close)); const bottom = priceY(Math.min(candle.open, candle.close)); return <g key={index}><line x1={x(index)} x2={x(index)} y1={priceY(candle.high)} y2={priceY(candle.low)} stroke={color} strokeWidth="2.5" /><rect x={x(index) - step * .29} y={top} width={step * .58} height={Math.max(3, bottom - top)} fill={color} rx="1.5" /></g>;})}
    {highlight && <g opacity={highlightProgress}><rect x={x(highlight.from) - step * .45} y={priceY(highlightHigh)} width={x(highlight.to) - x(highlight.from) + step * .9} height={priceY(highlightLow) - priceY(highlightHigh)} fill={`${highlight.color}12`} stroke={highlight.color} strokeWidth="3" strokeDasharray="10 7" /><path d={`M ${x(highlight.from)} ${priceY(highlightHigh) - 16} L ${x(highlight.to)} ${priceY(highlightHigh) - 16}`} fill="none" stroke={highlight.color} strokeWidth="4" strokeLinecap="round" /><path d={`M ${x(highlight.to) - 13} ${priceY(highlightHigh) - 27} L ${x(highlight.to)} ${priceY(highlightHigh) - 16} L ${x(highlight.to) - 13} ${priceY(highlightHigh) - 5}`} fill="none" stroke={highlight.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><rect x={Math.max(left + 8, Math.min(w - right - 300, x(highlight.from)))} y={Math.max(priceTop + 10, priceY(highlightHigh) - 62)} width="290" height="38" rx="19" fill={highlight.color} /><text x={Math.max(left + 153, Math.min(w - right - 155, x(highlight.from) + 145))} y={Math.max(priceTop + 36, priceY(highlightHigh) - 36)} textAnchor="middle" fill={C.bg} fontFamily={font} fontSize="18" fontWeight="900">{highlight.label}</text></g>}
    {teach && <>
      <path d={teachCandles.map((candle, offset) => `${offset ? "L" : "M"} ${x(teachStart + offset).toFixed(1)} ${priceY(candle.close).toFixed(1)}`).join(" ")} fill="none" stroke={C.gold} strokeWidth="3" strokeDasharray="8 7" opacity=".88" pathLength="1" strokeDashoffset={1 - teachProgress} />
      {teach === "ker" && <><line x1={x(teachStart)} x2={x(focus)} y1={priceY(candles[teachStart].close)} y2={priceY(candles[focus].close)} stroke={C.blue} strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - directProgress} opacity={directProgress} /><circle cx={x(teachStart)} cy={priceY(candles[teachStart].close)} r="7" fill={C.blue} opacity={directProgress} /><circle cx={x(focus)} cy={priceY(candles[focus].close)} r="7" fill={C.blue} opacity={directProgress} /><text x={left + 8} y={priceBottom - 14} fill={C.gold} fontSize="21" fontWeight="720" fontFamily={font} opacity={teachProgress}>金色虚线：14 根收盘路径</text><text x={w - right - 8} y={priceBottom - 14} textAnchor="end" fill={C.blue} fontSize="21" fontWeight="720" fontFamily={font} opacity={directProgress}>蓝线：净位移</text></>}
      {teach === "chop" && <>{teachCandles.map((candle, index) => { const alpha = interpolate(teachProgress, [index / teachCandles.length, (index + 1) / teachCandles.length], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}); const candleIndex = teachStart + index; return <g key={`tr-${candleIndex}`} opacity={alpha}><line x1={x(candleIndex)} x2={x(candleIndex)} y1={priceY(candle.high)} y2={priceY(candle.low)} stroke={C.gold} strokeWidth="5" /><line x1={x(candleIndex) - 7} x2={x(candleIndex) + 7} y1={priceY(candle.high)} y2={priceY(candle.high)} stroke={C.gold} strokeWidth="3" /><line x1={x(candleIndex) - 7} x2={x(candleIndex) + 7} y1={priceY(candle.low)} y2={priceY(candle.low)} stroke={C.gold} strokeWidth="3" /></g>;})}<rect x={x(teachStart) - step * .42} y={priceY(teachHigh)} width={x(focus) - x(teachStart) + step * .84} height={priceY(teachLow) - priceY(teachHigh)} fill={`${state.color}10`} stroke={state.color} strokeWidth="3" strokeDasharray="9 7" opacity={directProgress} /><text x={left + 8} y={priceBottom - 14} fill={C.gold} fontSize="21" fontWeight="720" fontFamily={font} opacity={teachProgress}>金色竖线：每根 K 线的真实波幅</text><text x={w - right - 8} y={priceBottom - 14} textAnchor="end" fill={state.color} fontSize="21" fontWeight="720" fontFamily={font} opacity={directProgress}>虚框：同一段的高低区间</text></>}
    </>}
    <rect x={left} y={indicatorTop} width={w - left - right} height={indicatorBottom - indicatorTop} fill="#08131f" stroke="#2a4053" strokeWidth="1.5" />
    {metric === "chop" ? <><rect x={left} y={indicatorTop} width={w - left - right} height={indicatorY(61.8) - indicatorTop} fill={`${C.red}1c`} /><rect x={left} y={indicatorY(61.8)} width={w - left - right} height={indicatorY(38.2) - indicatorY(61.8)} fill={`${C.gold}16`} /><rect x={left} y={indicatorY(38.2)} width={w - left - right} height={indicatorBottom - indicatorY(38.2)} fill={`${C.green}12`} /><text x={left + 12} y={indicatorTop + 63} fill={C.red} fontFamily={font} fontWeight="800" fontSize="19">&gt; 61.8 震荡行情</text><text x={left + 12} y={indicatorY(50)} fill={C.gold} fontFamily={font} fontWeight="800" fontSize="19">38.2–61.8 过渡 / 不明朗</text><text x={left + 12} y={indicatorBottom - 38} fill={C.green} fontFamily={font} fontWeight="800" fontSize="19">&lt; 38.2 趋势行情</text></> : <><rect x={left} y={indicatorY(.15)} width={w - left - right} height={indicatorBottom - indicatorY(.15)} fill={`${C.red}1c`} /><rect x={left} y={indicatorY(.3)} width={w - left - right} height={indicatorY(.15) - indicatorY(.3)} fill={`${C.gold}16`} /><rect x={left} y={indicatorY(.7)} width={w - left - right} height={indicatorY(.3) - indicatorY(.7)} fill={`${C.blue}16`} /><rect x={left} y={indicatorTop} width={w - left - right} height={indicatorY(.7) - indicatorTop} fill={`${C.green}12`} /><text x={left + 12} y={indicatorTop + 63} fill={C.green} fontFamily={font} fontWeight="800" fontSize="19">&gt; 0.70 强趋势</text><text x={left + 12} y={indicatorY(.5)} fill={C.blue} fontFamily={font} fontWeight="800" fontSize="19">0.30–0.70 弱趋势</text><text x={left + 12} y={indicatorY(.22)} fill={C.gold} fontFamily={font} fontWeight="800" fontSize="19">0.15–0.30 混沌</text><text x={left + 12} y={indicatorBottom - 38} fill={C.red} fontFamily={font} fontWeight="800" fontSize="19">≤ 0.15 箱体震荡</text></>}
    {thresholds.map((threshold) => <g key={threshold}><line x1={left} x2={w - right} y1={indicatorY(threshold)} y2={indicatorY(threshold)} stroke="#bdcbd8" strokeWidth="2" strokeDasharray="9 8" opacity=".75" /><text x={w - right - 6} y={indicatorY(threshold) - 10} textAnchor="end" fill={C.text} fontFamily={font} fontSize="22" fontWeight="750">{threshold}</text></g>)}
    <path d={line} fill="none" stroke={C.blue} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    {highlight && <path d={highlightPath} fill="none" stroke={highlight.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - highlightProgress} />}
    <line x1={x(focus)} x2={x(focus)} y1={priceTop} y2={indicatorBottom} stroke="#d9e7f2" strokeWidth="2" strokeDasharray="10 10" opacity={opacity * .75} />
    <circle cx={x(focus)} cy={priceY(candles[focus].close)} r="7" fill={C.text} stroke={state.color} strokeWidth="4" opacity={opacity} /><circle cx={x(focus)} cy={indicatorY(focusValue)} r="11" fill={C.blue} stroke={C.text} strokeWidth="3" opacity={opacity} />
    <g opacity={opacity}><rect x={badgeX} y={badgeY} width="138" height="44" rx="22" fill={state.color} /><text x={badgeX + 69} y={badgeY + 30} textAnchor="middle" fill={C.bg} fontFamily={font} fontWeight="900" fontSize="22">{metric === "chop" ? "CHOP" : "KER"} {metric === "chop" ? focusValue.toFixed(1) : focusValue.toFixed(2)}</text></g>
    <text x={left + 12} y={indicatorTop + 34} fill={C.text} fontFamily={font} fontWeight="850" fontSize="25">{metric === "chop" ? "柴金震荡指数（CHOP）" : "价格路径效率（KER）"}</text>
  </svg>;
};

const Caption: React.FC<{captions: TimedCaption[]}> = ({captions}) => { const frame = useCurrentFrame(); const ms = frame * 1000 / fps; const active = captions.find((caption) => ms >= caption.startMs && ms <= caption.endMs); const text = active?.text.replace(/柴金震荡指数/g, "柴金震荡指数（CHOP）").replace(/价格路径效率/g, "价格路径效率（KER）"); return active ? <div style={{position: "absolute", left: 46, right: 46, bottom: 76, minHeight: 102, padding: "18px 24px", boxSizing: "border-box", borderRadius: 22, background: "#06101def", border: `1px solid ${C.grid}`, color: C.text, display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center", fontFamily: font, fontSize: 31, lineHeight: 1.3, fontWeight: 700}}>{text}</div> : null; };
const Frame: React.FC<{scene: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode}> = ({scene, eyebrow, title, children}) => <AbsoluteFill style={{background: "radial-gradient(ellipse at 50% 12%, #163247 0%, #07111c 64%)", color: C.text, padding: "66px 48px 205px", boxSizing: "border-box", overflow: "hidden", fontFamily: font}}><Audio src={staticFile(`episodes/regime/voice/${scene}.mp3`)} /><div style={{position: "absolute", inset: 0, opacity: .1, backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`, backgroundSize: "72px 72px"}} /><div style={{position: "relative", color: C.green, fontSize: 22, fontWeight: 850, letterSpacing: 2.1}}>{eyebrow}</div><div style={{position: "relative", marginTop: 13, fontSize: 51, fontWeight: 880, lineHeight: 1.16}}>{title}</div><div style={{position: "relative", flex: 1, display: "flex", alignItems: "center", marginTop: 30}}>{children}</div><Caption captions={voice[scene].captions} /></AbsoluteFill>;

const OpeningVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const draw = visible(frame, 0, 42);
  // Names appear only after the narration has said "推荐两个常用的指标".
  const first = visible(frame, 188, 16);
  const second = visible(frame, 222, 16);
  const scan = interpolate(frame, [0, 130], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  return <div style={{width: "100%", display: "grid", gap: 28}}>
    <div style={{height: 470, borderRadius: 28, border: `1px solid ${C.grid}`, background: C.panel, overflow: "hidden", position: "relative"}}>
      <svg viewBox="0 0 960 470" style={{width: "100%", height: "100%"}}>
        {[90, 180, 270, 360].map((y) => <line key={y} x1="0" x2="960" y1={y} y2={y} stroke={C.grid} opacity=".72" />)}
        <path d="M 62 330 C 150 330 145 290 215 292 S 290 320 350 274 S 440 254 512 210 S 615 190 700 135 S 810 95 912 68" fill="none" stroke={C.green} strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
        <path d="M 62 170 C 120 102 174 244 230 158 S 348 251 405 150 S 520 242 585 164 S 702 254 775 166 S 860 230 912 175" fill="none" stroke={C.red} strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw} />
        <line x1={62 + 850 * scan} x2={62 + 850 * scan} y1="40" y2="420" stroke={C.gold} strokeWidth="3" strokeDasharray="9 8" opacity=".8" />
        <text x="72" y="68" fill={C.green} fontFamily={font} fontWeight="850" fontSize="31">趋势：持续推进</text>
        <text x="72" y="430" fill={C.red} fontFamily={font} fontWeight="850" fontSize="31">震荡：来回拉扯</text>
      </svg>
    </div>
    <div style={{display: "grid", gap: 18}}>
      <div style={{opacity: first, transform: `translateX(${(1 - first) * -80}px)`, borderRadius: 22, padding: "24px 28px", background: "#102133", border: `2px solid ${C.gold}99`, color: C.text, fontSize: 34, fontWeight: 850}}>柴金震荡指数 <span style={{color: C.gold}}>（CHOP）</span></div>
      <div style={{opacity: second, transform: `translateX(${(1 - second) * 80}px)`, borderRadius: 22, padding: "24px 28px", background: "#102133", border: `2px solid ${C.blue}99`, color: C.text, fontSize: 34, fontWeight: 850}}>价格路径效率 <span style={{color: C.blue}}>（KER）</span></div>
    </div>
  </div>;
};

const EndingVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const first = visible(frame, 0, 15);
  const second = visible(frame, 42, 15);
  const final = visible(frame, 94, 16);
  return <div style={{width: "100%", display: "grid", gap: 24}}>
    <div style={{opacity: first, transform: `translateY(${(1 - first) * 36}px)`, borderRadius: 26, padding: "34px", background: C.panel, border: `2px solid ${C.gold}99`}}><div style={{fontSize: 28, color: C.gold, fontWeight: 850}}>柴金震荡指数（CHOP）</div><div style={{fontSize: 37, fontWeight: 850, marginTop: 12}}>有没有脱离震荡区间</div></div>
    <div style={{opacity: second, transform: `translateY(${(1 - second) * 36}px)`, borderRadius: 26, padding: "34px", background: C.panel, border: `2px solid ${C.blue}99`}}><div style={{fontSize: 28, color: C.blue, fontWeight: 850}}>价格路径效率（KER）</div><div style={{fontSize: 37, fontWeight: 850, marginTop: 12}}>收盘价有没有持续推进</div></div>
    <div style={{opacity: final, transform: `scale(${.92 + final * .08})`, marginTop: 20, borderRadius: 30, padding: "38px 26px", textAlign: "center", border: `2px solid ${C.green}`, background: "#0c2929", color: C.text, fontSize: 42, lineHeight: 1.28, fontWeight: 900}}>帮你看清眼前更像<br /><span style={{color: C.green}}>震荡，还是趋势行情</span></div>
  </div>;
};

const Opening: React.FC = () => <Frame scene="opening" eyebrow="MARKET REGIME" title={<>趋势，还是<span style={{color: C.gold}}>震荡</span>？</>}><OpeningVisual /></Frame>;
const ChopPrinciple: React.FC = () => { const trend = useCurrentFrame() / fps > 13.8; return <Frame scene="chop-principle" eyebrow="柴金震荡指数（CHOP）" title={<>波动，最后有没有<br /><span style={{color: C.gold}}>走出区间</span>？</>}><TradingChart metric="chop" focus={trend ? points.trend : points.range} start={trend ? 29 : 7} end={trend ? 70 : 46} headline={trend ? "价格持续推开" : "波动很多，价格没走开"} detail={trend ? "大部分波动变成位移" : "真实波幅不断累积"} teach="chop" /></Frame>; };
const ChopZones: React.FC = () => {
  const second = useCurrentFrame() / fps;
  const phase = second < chopCues.trend ? "range" : second < chopCues.transition ? "trend" : second < chopCues.rangeToTransition ? "transition" : second < chopCues.trendToTransition ? "rangeToTransition" : "trendToTransition";
  const setup = phase === "range"
    ? {focus: points.range, window: [7, 46], info: ["CHOP 高于 61.8", "处于震荡行情"], highlight: {from: 22, to: points.range, label: "这段 K 线来回拉扯", color: C.red}}
    : phase === "trend"
      ? {focus: points.trend, window: [29, 70], info: ["CHOP 低于 38.2", "处于趋势行情"], highlight: {from: 47, to: points.trend, label: "这段 K 线持续推开", color: C.green}}
      : phase === "transition"
        ? {focus: points.fade, window: [60, 96], info: ["CHOP 在 38.2–61.8", "过渡区 / 趋势不明朗"], highlight: {from: 68, to: points.fade, label: "既非明确趋势，也非震荡", color: C.gold}}
        : phase === "rangeToTransition"
        ? {focus: points.highToTransition, window: [22, 50], info: ["CHOP 从 61.8 上方进入过渡区", "震荡在缓解"], highlight: {from: points.range, to: points.highToTransition, label: "震荡 → 过渡区", color: C.gold}}
        : {focus: points.fade, window: [55, 88], info: ["CHOP 从 38.2 下方回到过渡区", "趋势开始减弱"], highlight: {from: points.trend, to: points.fade, label: "趋势 → 过渡区", color: C.gold}};
  return <Frame scene="chop-zones" eyebrow="柴金震荡指数（CHOP）" title={<>同一条曲线，<br /><span style={{color: C.gold}}>3 个区间</span></>}><TradingChart metric="chop" focus={setup.focus} start={setup.window[0]} end={setup.window[1]} headline={setup.info[0]} detail={setup.info[1]} highlight={setup.highlight} /></Frame>;
};
const KerPrinciple: React.FC = () => { const trend = useCurrentFrame() / fps > 11.7; const focus = trend ? points.kerTrend : points.kerRange; return <Frame scene="ker-principle" eyebrow="价格路径效率（KER）" title={<>价格离起点，<br /><span style={{color: C.blue}}>到底有多远</span>？</>}><TradingChart metric="ker" focus={focus} start={trend ? 38 : 8} end={trend ? 65 : 35} headline={trend ? "同样 14 根 K 线，终点明显推开" : "同样 14 根 K 线，终点仍在附近"} detail={trend ? "路径效率更高" : "路径效率更低"} teach="ker" highlight={{from: focus - 14, to: focus, label: "参与计算的 14 根 K 线", color: C.blue}} /></Frame>; };
const KerZones: React.FC = () => {
  const second = useCurrentFrame() / fps;
  const phase = second < kerCues.chaos ? "box" : second < kerCues.weak ? "chaos" : second < kerCues.strong ? "weak" : "strong";
  const setup = phase === "box"
    ? {focus: points.kerRange, window: [8, 36], info: ["KER ≤ 0.15", "箱体震荡"], highlight: {from: 11, to: points.kerRange, label: "终点仍在起点附近", color: C.red}}
    : phase === "chaos"
      ? {focus: points.kerChaos, window: [10, 39], info: ["KER 在 0.15–0.30", "混沌/不明朗"], highlight: {from: 15, to: points.kerChaos, label: "仍在反复拉扯", color: C.gold}}
      : phase === "weak"
        ? {focus: points.kerForming, window: [25, 56], info: ["KER 在 0.30–0.70", "弱趋势"], highlight: {from: 31, to: points.kerForming, label: "价格开始推开", color: C.blue}}
        : {focus: points.kerTrend, window: [35, 68], info: ["KER > 0.70", "强趋势"], highlight: {from: 41, to: points.kerTrend, label: "推进更连贯", color: C.green}};
  return <Frame scene="ker-zones" eyebrow="价格路径效率（KER）" title={<>同一段价格，<br /><span style={{color: C.blue}}>推进效率不同</span></>}><TradingChart metric="ker" focus={setup.focus} start={setup.window[0]} end={setup.window[1]} headline={setup.info[0]} detail={setup.info[1]} highlight={setup.highlight} /></Frame>;
};
const Closing: React.FC = () => <Frame scene="close" eyebrow="MARKET REGIME" title={<>先分清<span style={{color: C.gold}}>环境</span>，<br />再看信号</>}><EndingVisual /></Frame>;

const scenes = ["opening", "chop-principle", "chop-zones", "ker-principle", "ker-zones", "close"] as const;
const frames = (scene: string) => Math.ceil((voice[scene].durationMs + 300) * fps / 1000);
const durationInFrames = scenes.reduce((total, scene) => total + frames(scene), 0);
const Storyboard: React.FC = () => <Series><Series.Sequence name="开头" durationInFrames={frames("opening")}><Opening /></Series.Sequence><Series.Sequence name="CHOP 原理" durationInFrames={frames("chop-principle")}><ChopPrinciple /></Series.Sequence><Series.Sequence name="CHOP 区间" durationInFrames={frames("chop-zones")}><ChopZones /></Series.Sequence><Series.Sequence name="KER 原理" durationInFrames={frames("ker-principle")}><KerPrinciple /></Series.Sequence><Series.Sequence name="KER 区间" durationInFrames={frames("ker-zones")}><KerZones /></Series.Sequence><Series.Sequence name="结尾" durationInFrames={frames("close")}><Closing /></Series.Sequence></Series>;
export const RegimeComposition = () => <Composition id="RegimeExplainer" component={Storyboard} durationInFrames={durationInFrames} fps={fps} width={1080} height={1920} />;
