import React from "react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Composition, interpolate, Series, staticFile, useCurrentFrame} from "remotion";
import type {Caption} from "@remotion/captions";
import voiceJson from "./keltner-voice.json";

type Candle = {open: number; high: number; low: number; close: number};
type Channel = {mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null>; atr: Array<number | null>};
type VoiceScene = {durationMs: number; captions: Array<Caption & {stage?: number}>};
type VoiceData = Record<string, VoiceScene>;

const voice = voiceJson as VoiceData;
const fps = 30;
const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const C = {bg: "#07111c", panel: "#0d1c2b", grid: "#294052", text: "#eef5fa", muted: "#91a7b9", green: "#16c7a2", red: "#f34d66", blue: "#42a6ff", gold: "#ffcb58", band: "#4caeff"};

const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const rangeReturns = [0.003, -0.004, 0.002, -0.003, 0.004, -0.002, -0.003, 0.003, -0.002, 0.004, -0.004, 0.002, 0.003, -0.003, 0.002, -0.004, 0.003, 0.002, -0.003, 0.004, -0.002, 0.003, -0.004, 0.002];
const continuationReturns = [...rangeReturns, 0.005, -0.003, 0.006, -0.004, 0.007, -0.002, 0.014, 0.011, 0.013, 0.01, -0.006, -0.009, -0.004, 0.012, 0.01, 0.014, -0.004, 0.008, 0.01, -0.003, 0.011, 0.006, -0.004, 0.009, 0.007];
const failureReturns = [...rangeReturns, 0.004, -0.003, 0.006, -0.004, 0.008, -0.003, 0.016, 0.013, 0.011, -0.004, -0.014, -0.016, -0.012, 0.003, -0.009, -0.006, 0.004, -0.005, -0.003, 0.002, -0.004, 0.003, -0.005, 0.001];
const compressionReturns = [...rangeReturns, 0.0032, -0.003, 0.0025, -0.0024, 0.0019, -0.0018, 0.0015, -0.0013, 0.0012, -0.0011, 0.0009, -0.0008, 0.02, 0.017, 0.014, -0.005, 0.018, 0.013, -0.004, 0.017, 0.012, -0.003, 0.014, 0.01];
const lowVolMeasureReturns = [...rangeReturns, .004, .003, -.001, .0045, .003, -.0015, .004, .0025, -.001, .004, .003, -.0012, .0035, .0028, -.001, .0035, .0025, -.0008, .003, -.0005, .018];
const highVolMeasureReturns = [...rangeReturns, .014, .009, -.016, .012, -.013, .015, .008, -.017, .013, -.011, .016, .007, -.015, .012, -.01, .014, .006, -.014, .011, -.009, .018];

const makeCandles = (returns: number[], seed: number, wickScale = 1): Candle[] => {
  const random = seeded(seed);
  const close = [100];
  returns.forEach((move) => close.push(close[close.length - 1] * (1 + move)));
  return close.map((value, index) => {
    const prev = close[Math.max(0, index - 1)];
    const open = index === 0 ? value * .998 : prev * (1 + (random() - .5) * .0036);
    const upper = (.002 + random() * .0045) * wickScale;
    const lower = (.002 + random() * .0048) * wickScale;
    return {open, close: value, high: Math.max(open, value) * (1 + upper), low: Math.min(open, value) * (1 - lower)};
  });
};

// Memo-free helper keeps the formula deterministic and avoids hand-drawn bands.
const emaCache = (values: number[], period: number): Array<number | null> => {
  const result: Array<number | null> = values.map(() => null);
  let current = 0;
  values.forEach((value, index) => {
    if (index === period - 1) {
      current = values.slice(0, period).reduce((sum, item) => sum + item, 0) / period;
      result[index] = current;
    } else if (index >= period) {
      current = value * (2 / (period + 1)) + current * (1 - 2 / (period + 1));
      result[index] = current;
    }
  });
  return result;
};

const calculateChannel = (candles: Candle[]): Channel => {
  const closes = candles.map((candle) => candle.close);
  const mid = emaCache(closes, 20);
  const tr = candles.map((candle, index) => index === 0 ? candle.high - candle.low : Math.max(candle.high - candle.low, Math.abs(candle.high - candles[index - 1].close), Math.abs(candle.low - candles[index - 1].close)));
  const atr: Array<number | null> = tr.map(() => null);
  let value = 0;
  tr.forEach((item, index) => {
    if (index === 9) { value = tr.slice(0, 10).reduce((sum, part) => sum + part, 0) / 10; atr[index] = value; }
    else if (index > 9) { value = (value * 9 + item) / 10; atr[index] = value; }
  });
  return {mid, atr, upper: mid.map((item, index) => item === null || atr[index] === null ? null : item + 2 * atr[index]!), lower: mid.map((item, index) => item === null || atr[index] === null ? null : item - 2 * atr[index]!)};
};

const continuation = makeCandles(continuationReturns, 602, 1.05);
const failure = makeCandles(failureReturns, 805, 1.08);
const compression = makeCandles(compressionReturns, 991, 0.9);
const lowVolMeasure = makeCandles(lowVolMeasureReturns, 401, .6);
const highVolMeasure = makeCandles(highVolMeasureReturns, 402, 2);
const continuationChannel = calculateChannel(continuation);
const failureChannel = calculateChannel(failure);
const compressionChannel = calculateChannel(compression);
const lowVolMeasureChannel = calculateChannel(lowVolMeasure);
const highVolMeasureChannel = calculateChannel(highVolMeasure);

const firstIndex = (source: Candle[], condition: (index: number) => boolean, from: number, fallback: number) => {
  for (let index = from; index < source.length; index++) if (condition(index)) return index;
  return fallback;
};
const contBreak = firstIndex(continuation, (index) => continuationChannel.upper[index] !== null && continuation[index].close > continuationChannel.upper[index]!, 25, 31);
const contPullback = firstIndex(continuation, (index) => continuationChannel.upper[index] !== null && continuationChannel.mid[index] !== null && continuation[index].close < continuationChannel.upper[index]! && continuation[index].close > continuationChannel.mid[index]!, contBreak + 1, 37);
const failBreak = firstIndex(failure, (index) => failureChannel.upper[index] !== null && failure[index].high > failureChannel.upper[index]!, 25, 31);
const failReturn = firstIndex(failure, (index) => failureChannel.upper[index] !== null && failure[index].close < failureChannel.upper[index]!, failBreak + 1, 35);
const failCenter = firstIndex(failure, (index) => failureChannel.mid[index] !== null && failure[index].close < failureChannel.mid[index]!, failReturn + 1, 38);
const compressionBreak = firstIndex(compression, (index) => compressionChannel.upper[index] !== null && compression[index].close > compressionChannel.upper[index]!, 35, 36);

const appear = (frame: number, start: number, duration = 12) => interpolate(frame, [start, start + duration], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
const numberAt = (values: Array<number | null>, index: number) => values[index] ?? 0;
const linePath = (values: Array<number | null>, start: number, end: number, x: (i: number) => number, y: (n: number) => number) => values.slice(start, end + 1).map((value, offset) => value === null ? "" : `${offset === 0 || values[start + offset - 1] === null ? "M" : "L"} ${x(start + offset).toFixed(1)} ${y(value).toFixed(1)}`).filter(Boolean).join(" ");

type ChartProps = {candles: Candle[]; channel: Channel; start: number; end: number; focus?: number; label?: string; color?: string; showFormula?: boolean; reveal?: "all" | "center-first"; emphasis?: {from: number; to: number; text: string; color: string; at?: number}; compact?: boolean; priceRange?: [number, number]; teachAtr?: boolean; stages?: Array<{at: number; until?: number; index: number; text: string; color: string}>; revealCandles?: boolean; revealStart?: number; revealDuration?: number; revealTimeline?: Array<[number, number]>; dimBefore?: number};

const KeltnerChart: React.FC<ChartProps> = ({candles, channel, start, end, focus, label, color = C.gold, showFormula, reveal = "all", emphasis, compact = false, priceRange, teachAtr = false, stages = [], revealCandles = false, revealStart = 10, revealDuration = 150, revealTimeline, dimBefore}) => {
  const frame = useCurrentFrame();
  const w = 980, h = compact ? 510 : 1020, left = 48, right = 42, top = showFormula ? 146 : 80, bottom = h - 58;
  const step = (w - left - right) / Math.max(1, end - start);
  const view = candles.slice(start, end + 1);
  const channelValues = [...channel.upper.slice(start, end + 1), ...channel.lower.slice(start, end + 1)].filter((value): value is number => value !== null);
  const min = priceRange ? priceRange[0] : Math.min(...view.map((candle) => candle.low), ...channelValues);
  const max = priceRange ? priceRange[1] : Math.max(...view.map((candle) => candle.high), ...channelValues);
  const pad = (max - min) * .1;
  const x = (index: number) => left + (index - start) * step;
  const y = (value: number) => bottom - (value - (min - pad)) / (max - min + 2 * pad) * (bottom - top);
  const centerAlpha = reveal === "center-first" ? appear(frame, 18) : 1;
  const bandAlpha = reveal === "center-first" ? appear(frame, 88) : 1;
  const draw = appear(frame, 0, 35);
  const visiblePosition = revealTimeline ? interpolate(frame, revealTimeline.map(([at]) => at), revealTimeline.map(([, index]) => index), {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : revealCandles ? interpolate(frame, [revealStart, revealStart + revealDuration], [start, end], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : end;
  const visibleEnd = Math.floor(visiblePosition);
  const upperPath = linePath(channel.upper, start, visibleEnd, x, y);
  const lowerPath = linePath(channel.lower, start, visibleEnd, x, y);
  const midPath = linePath(channel.mid, start, visibleEnd, x, y);
  const envelopePoints = Array.from({length: visibleEnd - start + 1}, (_, offset) => start + offset).filter((index) => channel.upper[index] !== null && channel.lower[index] !== null);
  const envelopePath = envelopePoints.length ? `M ${envelopePoints.map((index) => `${x(index).toFixed(1)} ${y(numberAt(channel.upper, index)).toFixed(1)}`).join(" L ")} L ${envelopePoints.slice().reverse().map((index) => `${x(index).toFixed(1)} ${y(numberAt(channel.lower, index)).toFixed(1)}`).join(" L ")} Z` : "";
  const emphasisAlpha = emphasis ? appear(frame, emphasis.at ?? 28) : 0;
  const candleAlpha = appear(frame, 0, 12);
  const atrMarks = teachAtr ? [end - 7, end - 5, end - 3].filter((index) => index >= start) : [];
  const high = emphasis ? Math.max(...candles.slice(emphasis.from, emphasis.to + 1).map((candle) => candle.high)) : 0;
  const low = emphasis ? Math.min(...candles.slice(emphasis.from, emphasis.to + 1).map((candle) => candle.low)) : 0;
  return <svg viewBox={`0 0 ${w} ${h}`} style={{width: "100%", display: "block"}}>
    <rect width={w} height={h} rx="28" fill={C.panel} stroke="#294154" strokeWidth="2"/>
    {[0, .25, .5, .75, 1].map((fraction) => <line key={`h${fraction}`} x1={left} x2={w - right} y1={top + (bottom - top) * fraction} y2={top + (bottom - top) * fraction} stroke={C.grid} opacity=".7" />)}
    {[0, .25, .5, .75, 1].map((fraction) => <line key={`v${fraction}`} x1={left + (w - left - right) * fraction} x2={left + (w - left - right) * fraction} y1={top} y2={bottom} stroke={C.grid} opacity=".45" />)}
    {label && <text x={left} y="42" fill={color} fontSize="24" fontWeight="900" fontFamily={font}>{label}</text>}
    {showFormula && <g opacity={appear(frame, 118)}><rect x={left} y="57" width={w - left - right} height="58" rx="14" fill="#10263a" stroke={C.band} /><text x={w / 2} y="94" textAnchor="middle" fill={C.text} fontFamily={font} fontSize="21" fontWeight="800">上轨 = EMA20 + 2 × ATR10 ｜ 下轨 = EMA20 − 2 × ATR10</text></g>}
    <path d={envelopePath} fill={C.band} opacity={bandAlpha * .12} />
    <path d={upperPath} fill="none" stroke={C.band} strokeWidth="4" strokeDasharray="10 7" strokeLinecap="round" opacity={bandAlpha} pathLength="1" strokeDashoffset={1 - draw}/>
    <path d={lowerPath} fill="none" stroke={C.band} strokeWidth="4" strokeDasharray="10 7" strokeLinecap="round" opacity={bandAlpha} pathLength="1" strokeDashoffset={1 - draw}/>
    <path d={midPath} fill="none" stroke={C.gold} strokeWidth="4.8" strokeLinecap="round" opacity={centerAlpha} pathLength="1" strokeDasharray="1" strokeDashoffset={1 - draw}/>
    {view.map((candle, offset) => { const index = start + offset; const green = candle.close >= candle.open; const fill = green ? C.green : C.red; const bodyTop = y(Math.max(candle.open, candle.close)); const bodyBottom = y(Math.min(candle.open, candle.close)); const shown = index <= Math.ceil(visiblePosition); const born = revealTimeline ? interpolate(visiblePosition, [index - 1, index], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}) : revealCandles ? appear(frame, revealStart + (index - start) * revealDuration / Math.max(1, end - start), 5) : candleAlpha; const muted = dimBefore !== undefined && index < dimBefore ? .3 : 1; return <g key={index} opacity={shown ? born * muted : 0} transform={`translate(0 ${(1 - born) * 10})`}><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={fill} strokeWidth="2.6"/><rect x={x(index) - step * .28} y={bodyTop} width={step * .56} height={Math.max(3, bodyBottom - bodyTop)} rx="1.8" fill={fill}/></g>;})}
    {teachAtr && atrMarks.map((index, mark) => <g key={`atr-${index}`} opacity={appear(frame, 22 + mark * 32)}><line x1={x(index)} x2={x(index)} y1={y(candles[index].high)} y2={y(candles[index].low)} stroke={C.gold} strokeWidth="7"/><line x1={x(index) - 8} x2={x(index) + 8} y1={y(candles[index].high)} y2={y(candles[index].high)} stroke={C.gold} strokeWidth="3"/><line x1={x(index) - 8} x2={x(index) + 8} y1={y(candles[index].low)} y2={y(candles[index].low)} stroke={C.gold} strokeWidth="3"/></g>)}
    {teachAtr && <g opacity={appear(frame, 125)}><line x1={x(end) - 38} x2={x(end) - 38} y1={y(numberAt(channel.upper, end))} y2={y(numberAt(channel.lower, end))} stroke={C.band} strokeWidth="4"/><path d={`M ${x(end) - 48} ${y(numberAt(channel.upper, end)) + 12} L ${x(end) - 38} ${y(numberAt(channel.upper, end))} L ${x(end) - 28} ${y(numberAt(channel.upper, end)) + 12} M ${x(end) - 48} ${y(numberAt(channel.lower, end)) - 12} L ${x(end) - 38} ${y(numberAt(channel.lower, end))} L ${x(end) - 28} ${y(numberAt(channel.lower, end)) - 12}`} fill="none" stroke={C.band} strokeWidth="4"/><rect x={w - 300} y={top + 16} width="230" height="38" rx="19" fill={C.band}/><text x={w - 185} y={top + 42} textAnchor="middle" fontFamily={font} fontSize="18" fontWeight="900" fill={C.bg}>ATR 变大 → 通道变宽</text></g>}
    {stages.map((stage) => { const alpha = stage.index <= visibleEnd ? appear(frame, stage.at) : 0; const tagY = Math.max(top + 18, y(candles[stage.index].close) - 58); const tagX = Math.max(left + 120, Math.min(w - right - 120, x(stage.index))); return <g key={`${stage.at}-${stage.index}`} opacity={alpha}><line x1={x(stage.index)} x2={x(stage.index)} y1={tagY + 38} y2={y(candles[stage.index].close) - 10} stroke={stage.color} strokeWidth="3" strokeDasharray="6 6"/><circle cx={x(stage.index)} cy={y(candles[stage.index].close)} r="9" fill={C.panel} stroke={stage.color} strokeWidth="4"/><rect x={tagX - 112} y={tagY} width="224" height="38" rx="19" fill={stage.color}/><text x={tagX} y={tagY + 26} textAnchor="middle" fontFamily={font} fontSize="17" fontWeight="900" fill={C.bg}>{stage.text}</text></g>;})}
    {emphasis && <g opacity={emphasisAlpha}><rect x={x(emphasis.from) - step * .45} y={y(high)} width={x(emphasis.to) - x(emphasis.from) + step * .9} height={y(low) - y(high)} fill={`${emphasis.color}12`} stroke={emphasis.color} strokeWidth="3" strokeDasharray="10 7"/><rect x={Math.max(left, x(emphasis.from))} y={Math.max(top + 12, y(high) - 59)} width="250" height="38" rx="19" fill={emphasis.color}/><text x={Math.max(left + 125, x(emphasis.from) + 125)} y={Math.max(top + 38, y(high) - 33)} textAnchor="middle" fontFamily={font} fontSize="18" fontWeight="900" fill={C.bg}>{emphasis.text}</text></g>}
    {focus !== undefined && focus <= visibleEnd && channel.upper[focus] !== null && <g opacity={appear(frame, 92)}><line x1={x(focus)} x2={x(focus)} y1={top} y2={bottom} stroke="#eff8ff" strokeDasharray="8 8" opacity=".65"/><circle cx={x(focus)} cy={y(candles[focus].close)} r={9 + Math.sin(frame / 6) * 3} fill={C.text} stroke={color} strokeWidth="4"/></g>}
    <g opacity={bandAlpha}><text x={w - right} y={y(numberAt(channel.upper, end)) - 12} textAnchor="end" fill={C.band} fontFamily={font} fontSize="19" fontWeight="850">上轨</text><text x={w - right} y={y(numberAt(channel.lower, end)) + 26} textAnchor="end" fill={C.band} fontFamily={font} fontSize="19" fontWeight="850">下轨</text></g>
    <text x={w - right} y={y(numberAt(channel.mid, end)) - 12} textAnchor="end" fill={C.gold} fontFamily={font} fontSize="19" fontWeight="850">EMA 中线</text>
  </svg>;
};

const CaptionBox: React.FC<{scene: string}> = ({scene}) => {
  const frame = useCurrentFrame();
  const ms = frame * 1000 / fps;
  const active = voice[scene].captions.find((caption) => ms >= caption.startMs && ms <= caption.endMs);
  return active ? <div style={{position: "absolute", bottom: 70, left: 42, right: 42, minHeight: 104, borderRadius: 24, border: `1px solid ${C.grid}`, background: "#06101df2", padding: "17px 24px", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: C.text, fontFamily: font, fontSize: 32, fontWeight: 750, lineHeight: 1.3}}>{active.text}</div> : null;
};

const Scene: React.FC<{id: string; eyebrow: string; title: React.ReactNode; children: React.ReactNode}> = ({id, eyebrow, title, children}) => <AbsoluteFill style={{background: "radial-gradient(ellipse at 50% 7%, #17364c 0%, #07111c 63%)", padding: "65px 48px 208px", boxSizing: "border-box", color: C.text, fontFamily: font, overflow: "hidden"}}><Audio src={staticFile(`episodes/keltner/voice/${id}.mp3`)}/><div style={{position: "absolute", inset: 0, opacity: .1, backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`, backgroundSize: "72px 72px"}}/><div style={{position: "relative", color: C.band, fontSize: 22, fontWeight: 900, letterSpacing: 2.2}}>{eyebrow}</div><div style={{position: "relative", marginTop: 13, fontSize: 51, fontWeight: 900, lineHeight: 1.16}}>{title}</div><div style={{position: "relative", flex: 1, display: "flex", alignItems: "center", marginTop: 28}}>{children}</div><CaptionBox scene={id}/></AbsoluteFill>;

const Pill: React.FC<{text: string; color: string; delay?: number}> = ({text, color, delay = 0}) => { const frame = useCurrentFrame(); const p = appear(frame, delay, 14); return <div style={{opacity: p, transform: `translateY(${(1 - p) * 18}px)`, padding: "18px 24px", borderRadius: 18, background: `${color}18`, border: `1.5px solid ${color}99`, color, fontSize: 27, fontWeight: 900, textAlign: "center"}}>{text}</div>; };

const VolatilityMeasure: React.FC = () => {
  const frame = useCurrentFrame();
  const second = appear(frame, 56, 14);
  const conclusion = appear(frame, 118, 14);
  const lastLow = lowVolMeasure.length - 1;
  const lastHigh = highVolMeasure.length - 1;
  return <div style={{width: "100%", display: "grid", gap: 20}}>
    <div style={{borderRadius: 26, overflow: "hidden", border: `2px solid ${C.green}88`}}><KeltnerChart candles={lowVolMeasure} channel={lowVolMeasureChannel} start={18} end={lastLow} focus={lastLow} label="近期波动较小：通道较窄" color={C.green} compact priceRange={[96, 109]} stages={[{at: 28, index: lastLow, text: "同样上涨，收盘越过上轨", color: C.green}]}/></div>
    <div style={{opacity: second, translate: `${(1 - second) * 46}px 0`, borderRadius: 26, overflow: "hidden", border: `2px solid ${C.band}88`}}><KeltnerChart candles={highVolMeasure} channel={highVolMeasureChannel} start={18} end={lastHigh} focus={lastHigh} label="此前大幅来回波动：通道较宽" color={C.band} compact priceRange={[96, 109]} stages={[{at: 86, index: lastHigh, text: "同样上涨，仍在通道内", color: C.band}]}/></div>
    <div style={{opacity: conclusion, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16}}><Pill text="窄通道：超出通常波幅" color={C.green}/><Pill text="宽通道：仍属正常波动" color={C.band}/><div style={{gridColumn: "1 / -1"}}><Pill text="越轨之后，再观察这股力量能否持续" color={C.gold}/></div></div>
  </div>;
};

const Hook: React.FC = () => <Scene id="hook" eyebrow="KELTNER CHANNEL" title={<>同样一段上涨，<br />放进不同<span style={{color: C.band}}>波动环境</span></>}><VolatilityMeasure/></Scene>;

const Parts: React.FC = () => <Scene id="parts" eyebrow="通道怎样形成" title={<>先看方向，<br />再看<span style={{color: C.band}}>正常波动边界</span></>}><KeltnerChart candles={continuation} channel={continuationChannel} start={14} end={38} focus={contBreak} label="EMA 给方向 · ATR 给范围" showFormula reveal="center-first" stages={[{at: 126, index: contBreak, text: "收盘越过上轨", color: C.green}]}/></Scene>;

const Expansion: React.FC = () => { const frame = useCurrentFrame(); const focus = frame < 105 ? contBreak : frame < 165 ? 39 : 47; const title = frame < 105 ? <>中轨开始<span style={{color: C.gold}}>向上转向</span></> : frame < 165 ? <>价格开始<span style={{color: C.green}}>沿上轨推进</span></> : <>通道继续抬升，<br /><span style={{color: C.band}}>带宽持续扩张</span></>; return <Scene id="expansion" eyebrow="方向 + 波动同步增强" title={title}><KeltnerChart candles={continuation} channel={continuationChannel} start={19} end={49} focus={focus} label="中轨转向 → 价格推进 → 带宽打开" color={frame < 105 ? C.gold : frame < 165 ? C.green : C.band} dimBefore={contBreak} stages={[{at: 32, index: contBreak, text: "中轨开始转向", color: C.gold}, {at: 105, index: 39, text: "价格沿上轨推进", color: C.green}, {at: 165, index: 47, text: "通道持续扩张", color: C.band}]}/></Scene>; };

const Pullback: React.FC = () => { const frame = useCurrentFrame(); const secondStage = voice.pullback.captions.find((caption) => caption.stage === 1); const switchAt = Math.round((secondStage?.startMs ?? 5427) * fps / 1000); const first = 1 - appear(frame, switchAt, 14); const second = appear(frame, switchAt, 14); return <Scene id="pullback" eyebrow="回踩后的结构判断" title={frame < switchAt ? <>守住中轨，<span style={{color: C.green}}>结构仍完整</span></> : <>跌破中轨，通道转平，<br /><span style={{color: C.red}}>力量开始减弱</span></>}><div style={{width: "100%", display: "grid"}}><div style={{gridArea: "1/1", opacity: first}}><KeltnerChart candles={continuation} channel={continuationChannel} start={20} end={44} focus={contPullback} label="回踩发生，但价格仍在 EMA 上方" color={C.green} stages={[{at: 58, index: contPullback, text: "中轨上方承接", color: C.green}]}/></div><div style={{gridArea: "1/1", opacity: second}}><KeltnerChart candles={failure} channel={failureChannel} start={20} end={49} focus={failCenter} label="跌破 EMA，同时通道不再扩张" color={C.red} stages={[{at: switchAt + 34, index: failCenter, text: "结构转弱", color: C.red}]}/></div></div></Scene>; };

const Compression: React.FC = () => { const frame = useCurrentFrame(); const compressionAt = 107; const breakoutAt = 213; const expansionAt = 260; const directionAt = 313; const title = frame < compressionAt ? <>先让行情<span style={{color: C.muted}}>自行形成</span></> : frame < breakoutAt ? <>通道长期收窄，<br /><span style={{color: C.gold}}>低波动压缩</span></> : frame < expansionAt ? <>随后价格<span style={{color: C.green}}>突破通道</span></> : frame < directionAt ? <>突破之后，<br /><span style={{color: C.band}}>带宽开始扩张</span></> : <>从波动压缩，<br />切换到<span style={{color: C.green}}>方向性扩张</span></>; const label = frame < compressionAt ? "观察通道宽度如何变化" : frame < breakoutAt ? "压缩区已经形成" : frame < expansionAt ? "价格离开原来的波动范围" : "通道随新波动持续打开"; return <Scene id="compression" eyebrow="我更关注的状态切换" title={title}><KeltnerChart candles={compression} channel={compressionChannel} start={18} end={48} focus={compressionBreak} label={label} color={frame < breakoutAt ? C.gold : frame < expansionAt ? C.green : C.band} revealTimeline={[[0, 18], [95, 35], [198, 35], [220, compressionBreak], [260, 40], [313, 46], [390, 48]]} emphasis={{from: 27, to: 35, text: "带宽长期收窄", color: C.gold, at: compressionAt}} stages={[{at: breakoutAt, index: compressionBreak, text: "价格突破", color: C.green}, {at: expansionAt, index: 40, text: "带宽开始扩张", color: C.band}, {at: directionAt, index: 46, text: "方向性扩张", color: C.green}]}/></Scene>; };

const FalseBreakout: React.FC = () => { const frame = useCurrentFrame(); const before = appear(frame, 28, 14); const after = appear(frame, 91, 14); const focus = frame < 218 ? failBreak : failReturn; return <Scene id="false_breakout" eyebrow="假突破风险更高的结构" title={<>突破前<span style={{color: C.gold}}>没有压缩</span>，<br />突破后<span style={{color: C.red}}>没有扩张</span></>}><div style={{width: "100%", display: "grid", gap: 24}}><div style={{opacity: before, translate: `${(1 - before) * -42}px 0`, borderRadius: 26, overflow: "hidden", border: `2px solid ${C.gold}88`}}><KeltnerChart candles={failure} channel={failureChannel} start={18} end={failBreak} label="突破前：通道宽度没有持续收窄" color={C.gold} compact emphasis={{from: 23, to: failBreak - 1, text: "没有明显压缩", color: C.gold, at: 35}}/></div><div style={{opacity: after, translate: `${(1 - after) * 42}px 0`, borderRadius: 26, overflow: "hidden", border: `2px solid ${C.red}88`}}><KeltnerChart candles={failure} channel={failureChannel} start={failBreak - 5} end={48} focus={focus} label={frame < 218 ? "突破后：短暂越过上轨，通道没有打开" : "突破后：价格重新回到通道内部"} color={frame < 218 ? C.gold : C.red} compact stages={[{at: 218, index: failReturn, text: "重新回到通道", color: C.red}]}/></div></div></Scene>; };

const Close: React.FC = () => { const frame = useCurrentFrame(); const items = [["突破前", "看长期压缩", C.gold], ["突破后", "看扩张与中轨转向", C.band], ["最后", "看能否留在通道外", C.green]] as const; return <Scene id="close" eyebrow="读取顺序" title={<>不是只看一次越轨，<br />而是看完整的<span style={{color: C.gold}}>状态变化</span></>}><div style={{width: "100%", display: "grid", gap: 20}}>{items.map(([tag, text, color], i) => { const p = appear(frame, i * 43, 15); return <div key={tag} style={{opacity: p, transform: `translateX(${(1-p)*45}px)`, height: 180, borderRadius: 25, background: `linear-gradient(100deg, ${color}22, ${C.panel} 55%)`, border: `1.5px solid ${color}88`, display: "grid", gridTemplateColumns: "170px 1fr", alignItems: "center", padding: "0 30px"}}><div style={{color, fontSize: 25, fontWeight: 900}}>{tag}</div><div style={{fontSize: 37, fontWeight: 900}}>{text}</div></div>;})}</div></Scene>; };

const sceneNames = ["hook", "parts", "expansion", "pullback", "compression", "false_breakout", "close"] as const;
const sceneFrames = (name: typeof sceneNames[number]) => Math.ceil((voice[name].durationMs + 260) * fps / 1000);
const durationInFrames = sceneNames.reduce((sum, name) => sum + sceneFrames(name), 0);
const Storyboard: React.FC = () => <Series><Series.Sequence name="指标解决什么问题" durationInFrames={sceneFrames("hook")}><Hook/></Series.Sequence><Series.Sequence name="通道怎样形成" durationInFrames={sceneFrames("parts")}><Parts/></Series.Sequence><Series.Sequence name="方向与波动同步增强" durationInFrames={sceneFrames("expansion")}><Expansion/></Series.Sequence><Series.Sequence name="回踩后的结构判断" durationInFrames={sceneFrames("pullback")}><Pullback/></Series.Sequence><Series.Sequence name="长期压缩后的突破" durationInFrames={sceneFrames("compression")}><Compression/></Series.Sequence><Series.Sequence name="假突破风险" durationInFrames={sceneFrames("false_breakout")}><FalseBreakout/></Series.Sequence><Series.Sequence name="读取顺序" durationInFrames={sceneFrames("close")}><Close/></Series.Sequence></Series>;

export const KeltnerComposition = () => <Composition id="KeltnerExplainer" component={Storyboard} durationInFrames={durationInFrames} fps={fps} width={1080} height={1920}/>;
