import React from "react";
import {Audio} from "@remotion/media";
import {AbsoluteFill, Composition, interpolate, Series, staticFile, useCurrentFrame} from "remotion";
import type {Caption} from "@remotion/captions";
import voiceJson from "./keltner-voice.json";

type Candle = {open: number; high: number; low: number; close: number};
type Channel = {mid: Array<number | null>; upper: Array<number | null>; lower: Array<number | null>; atr: Array<number | null>};
type VoiceScene = {durationMs: number; captions: Caption[]};
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
const quietReturns = [...rangeReturns, 0.001, -0.0012, 0.0009, -0.001, 0.0013, -0.0007, 0.0011, -0.001, 0.0008, -0.0011, 0.0012, -0.0008, 0.001, -0.0009, 0.0011, -0.001];
const volatileReturns = [...rangeReturns, 0.009, -0.011, 0.008, -0.01, 0.012, -0.009, 0.01, -0.013, 0.011, -0.008, 0.013, -0.01, 0.009, -0.012, 0.01, -0.008];
const compressionReturns = [...rangeReturns, 0.0032, -0.003, 0.0025, -0.0024, 0.0019, -0.0018, 0.0015, -0.0013, 0.0012, -0.0011, 0.0009, -0.0008, 0.02, 0.017, 0.014, -0.005, 0.018, 0.013, -0.004, 0.017, 0.012, -0.003, 0.014, 0.01];

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
const quiet = makeCandles(quietReturns, 112, .55);
const volatile = makeCandles(volatileReturns, 334, 2.15);
const compression = makeCandles(compressionReturns, 991, 0.9);
const continuationChannel = calculateChannel(continuation);
const failureChannel = calculateChannel(failure);
const quietChannel = calculateChannel(quiet);
const volatileChannel = calculateChannel(volatile);
const compressionChannel = calculateChannel(compression);

const firstIndex = (source: Candle[], condition: (index: number) => boolean, from: number, fallback: number) => {
  for (let index = from; index < source.length; index++) if (condition(index)) return index;
  return fallback;
};
const contBreak = firstIndex(continuation, (index) => continuationChannel.upper[index] !== null && continuation[index].close > continuationChannel.upper[index]!, 25, 31);
const contPullback = firstIndex(continuation, (index) => continuationChannel.upper[index] !== null && continuationChannel.mid[index] !== null && continuation[index].close < continuationChannel.upper[index]! && continuation[index].close > continuationChannel.mid[index]!, contBreak + 1, 37);
const contResume = firstIndex(continuation, (index) => continuationChannel.upper[index] !== null && continuation[index].close > continuationChannel.upper[index]!, contPullback + 1, 41);
const failBreak = firstIndex(failure, (index) => failureChannel.upper[index] !== null && failure[index].high > failureChannel.upper[index]!, 25, 31);
const failReturn = firstIndex(failure, (index) => failureChannel.upper[index] !== null && failure[index].close < failureChannel.upper[index]!, failBreak + 1, 35);
const failCenter = firstIndex(failure, (index) => failureChannel.mid[index] !== null && failure[index].close < failureChannel.mid[index]!, failReturn + 1, 38);
const compressionBreak = firstIndex(compression, (index) => compressionChannel.upper[index] !== null && compression[index].close > compressionChannel.upper[index]!, 35, 36);

const appear = (frame: number, start: number, duration = 12) => interpolate(frame, [start, start + duration], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
const numberAt = (values: Array<number | null>, index: number) => values[index] ?? 0;
const linePath = (values: Array<number | null>, start: number, end: number, x: (i: number) => number, y: (n: number) => number) => values.slice(start, end + 1).map((value, offset) => value === null ? "" : `${offset === 0 || values[start + offset - 1] === null ? "M" : "L"} ${x(start + offset).toFixed(1)} ${y(value).toFixed(1)}`).filter(Boolean).join(" ");

type ChartProps = {candles: Candle[]; channel: Channel; start: number; end: number; focus?: number; label?: string; color?: string; showFormula?: boolean; reveal?: "all" | "center-first"; emphasis?: {from: number; to: number; text: string; color: string}; compact?: boolean; priceRange?: [number, number]; teachAtr?: boolean; stages?: Array<{at: number; index: number; text: string; color: string}>};

const KeltnerChart: React.FC<ChartProps> = ({candles, channel, start, end, focus, label, color = C.gold, showFormula, reveal = "all", emphasis, compact = false, priceRange, teachAtr = false, stages = []}) => {
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
  const upperPath = linePath(channel.upper, start, end, x, y);
  const lowerPath = linePath(channel.lower, start, end, x, y);
  const midPath = linePath(channel.mid, start, end, x, y);
  const envelopePoints = Array.from({length: end - start + 1}, (_, offset) => start + offset).filter((index) => channel.upper[index] !== null && channel.lower[index] !== null);
  const envelopePath = envelopePoints.length ? `M ${envelopePoints.map((index) => `${x(index).toFixed(1)} ${y(numberAt(channel.upper, index)).toFixed(1)}`).join(" L ")} L ${envelopePoints.slice().reverse().map((index) => `${x(index).toFixed(1)} ${y(numberAt(channel.lower, index)).toFixed(1)}`).join(" L ")} Z` : "";
  const emphasisAlpha = emphasis ? appear(frame, 28) : 0;
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
    {view.map((candle, offset) => { const index = start + offset; const green = candle.close >= candle.open; const fill = green ? C.green : C.red; const bodyTop = y(Math.max(candle.open, candle.close)); const bodyBottom = y(Math.min(candle.open, candle.close)); return <g key={index} opacity={candleAlpha}><line x1={x(index)} x2={x(index)} y1={y(candle.high)} y2={y(candle.low)} stroke={fill} strokeWidth="2.6"/><rect x={x(index) - step * .28} y={bodyTop} width={step * .56} height={Math.max(3, bodyBottom - bodyTop)} rx="1.8" fill={fill}/></g>;})}
    {teachAtr && atrMarks.map((index, mark) => <g key={`atr-${index}`} opacity={appear(frame, 22 + mark * 32)}><line x1={x(index)} x2={x(index)} y1={y(candles[index].high)} y2={y(candles[index].low)} stroke={C.gold} strokeWidth="7"/><line x1={x(index) - 8} x2={x(index) + 8} y1={y(candles[index].high)} y2={y(candles[index].high)} stroke={C.gold} strokeWidth="3"/><line x1={x(index) - 8} x2={x(index) + 8} y1={y(candles[index].low)} y2={y(candles[index].low)} stroke={C.gold} strokeWidth="3"/></g>)}
    {teachAtr && <g opacity={appear(frame, 125)}><line x1={x(end) - 38} x2={x(end) - 38} y1={y(numberAt(channel.upper, end))} y2={y(numberAt(channel.lower, end))} stroke={C.band} strokeWidth="4"/><path d={`M ${x(end) - 48} ${y(numberAt(channel.upper, end)) + 12} L ${x(end) - 38} ${y(numberAt(channel.upper, end))} L ${x(end) - 28} ${y(numberAt(channel.upper, end)) + 12} M ${x(end) - 48} ${y(numberAt(channel.lower, end)) - 12} L ${x(end) - 38} ${y(numberAt(channel.lower, end))} L ${x(end) - 28} ${y(numberAt(channel.lower, end)) - 12}`} fill="none" stroke={C.band} strokeWidth="4"/><rect x={w - 300} y={top + 16} width="230" height="38" rx="19" fill={C.band}/><text x={w - 185} y={top + 42} textAnchor="middle" fontFamily={font} fontSize="18" fontWeight="900" fill={C.bg}>ATR 变大 → 通道变宽</text></g>}
    {stages.map((stage) => { const alpha = appear(frame, stage.at); const tagY = Math.max(top + 18, y(candles[stage.index].close) - 58); const tagX = Math.max(left + 120, Math.min(w - right - 120, x(stage.index))); return <g key={`${stage.at}-${stage.index}`} opacity={alpha}><line x1={x(stage.index)} x2={x(stage.index)} y1={tagY + 38} y2={y(candles[stage.index].close) - 10} stroke={stage.color} strokeWidth="3" strokeDasharray="6 6"/><circle cx={x(stage.index)} cy={y(candles[stage.index].close)} r="9" fill={C.panel} stroke={stage.color} strokeWidth="4"/><rect x={tagX - 112} y={tagY} width="224" height="38" rx="19" fill={stage.color}/><text x={tagX} y={tagY + 26} textAnchor="middle" fontFamily={font} fontSize="17" fontWeight="900" fill={C.bg}>{stage.text}</text></g>;})}
    {emphasis && <g opacity={emphasisAlpha}><rect x={x(emphasis.from) - step * .45} y={y(high)} width={x(emphasis.to) - x(emphasis.from) + step * .9} height={y(low) - y(high)} fill={`${emphasis.color}12`} stroke={emphasis.color} strokeWidth="3" strokeDasharray="10 7"/><rect x={Math.max(left, x(emphasis.from))} y={Math.max(top + 12, y(high) - 59)} width="250" height="38" rx="19" fill={emphasis.color}/><text x={Math.max(left + 125, x(emphasis.from) + 125)} y={Math.max(top + 38, y(high) - 33)} textAnchor="middle" fontFamily={font} fontSize="18" fontWeight="900" fill={C.bg}>{emphasis.text}</text></g>}
    {focus !== undefined && channel.upper[focus] !== null && <g opacity={appear(frame, 92)}><line x1={x(focus)} x2={x(focus)} y1={top} y2={bottom} stroke="#eff8ff" strokeDasharray="8 8" opacity=".65"/><circle cx={x(focus)} cy={y(candles[focus].close)} r="8" fill={C.text} stroke={color} strokeWidth="4"/></g>}
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

const Hook: React.FC = () => <Scene id="hook" eyebrow="KELTNER CHANNEL" title={<>同样突破<span style={{color: C.band}}>上轨</span>，<br />结局为什么不同？</>}><div style={{width: "100%", display: "grid", gap: 24}}><div style={{borderRadius: 25, overflow: "hidden", border: `2px solid ${C.green}`}}><KeltnerChart candles={continuation} channel={continuationChannel} start={19} end={50} focus={contResume} label="突破后留在通道外 → 延续" color={C.green} compact emphasis={{from: contBreak, to: contResume, text: "回踩后继续推进", color: C.green}}/></div><div style={{borderRadius: 25, overflow: "hidden", border: `2px solid ${C.red}`}}><KeltnerChart candles={failure} channel={failureChannel} start={19} end={50} focus={failCenter} label="刺破后回到通道内 → 失败" color={C.red} compact emphasis={{from: failBreak, to: failCenter, text: "突破没有站住", color: C.red}}/></div></div></Scene>;

const Parts: React.FC = () => <Scene id="parts" eyebrow="KELTNER CHANNEL" title={<>通道不是固定距离，<br />它会跟着<span style={{color: C.gold}}>波动</span>改变</>}><KeltnerChart candles={continuation} channel={continuationChannel} start={17} end={49} focus={contBreak} label="先画中线，再用 ATR 画出上下轨" showFormula reveal="center-first"/></Scene>;

const Width: React.FC = () => <Scene id="width" eyebrow="ATR 决定通道宽度" title={<>波动变大，<br />通道会<span style={{color: C.band}}>自动变宽</span></>}><div style={{width: "100%", display: "grid", gap: 26}}><div style={{borderRadius: 26, overflow: "hidden", border: `1px solid ${C.grid}`}}><KeltnerChart candles={quiet} channel={quietChannel} start={14} end={34} label="ATR 较低：正常波动空间较窄" color={C.gold} compact priceRange={[95, 105]} teachAtr/></div><div style={{borderRadius: 26, overflow: "hidden", border: `1px solid ${C.grid}`}}><KeltnerChart candles={volatile} channel={volatileChannel} start={14} end={34} label="ATR 较高：正常波动空间较宽" color={C.gold} compact priceRange={[95, 105]} teachAtr/></div></div></Scene>;

const Continuation: React.FC = () => <Scene id="continuation" eyebrow="有效突破" title={<>突破之后，<br />关键看能否<span style={{color: C.green}}>站住</span></>}><KeltnerChart candles={compression} channel={compressionChannel} start={18} end={48} focus={compressionBreak} label="长期收窄 → 收盘突破上轨 → 连续留在上轨外" color={C.green} emphasis={{from: 27, to: 35, text: "长期压缩区", color: C.gold}} stages={[{at: 58, index: 30, text: "通道持续收窄", color: C.gold}, {at: 100, index: compressionBreak, text: "收盘突破上轨", color: C.green}, {at: 200, index: 46, text: "连续留在上轨外", color: C.green}]}/></Scene>;

const Failure: React.FC = () => <Scene id="failure" eyebrow="失败突破" title={<>刺破上轨不重要，<br />重要的是有没有<span style={{color: C.red}}>留住</span></>}><KeltnerChart candles={failure} channel={failureChannel} start={18} end={51} focus={failCenter} label="刺破上轨 → 收回通道 → 跌破中线" color={C.red} emphasis={{from: failBreak, to: failCenter, text: "重新回到通道内", color: C.red}} stages={[{at: 38, index: failBreak, text: "刺破上轨", color: C.gold}, {at: 80, index: failReturn, text: "收回通道内", color: C.red}, {at: 125, index: failCenter, text: "跌破中线", color: C.red}]}/></Scene>;

const Close: React.FC = () => { const frame = useCurrentFrame(); const steps = [appear(frame, 0), appear(frame, 48), appear(frame, 96)]; const items = [["1", "中线方向", "市场偏强还是偏弱", C.gold], ["2", "是否收在通道外", "是否超出正常波动", C.band], ["3", "能不能留在通道外", "突破有没有延续", C.green]] as const; return <Scene id="close" eyebrow="KELTNER CHANNEL" title={<>看通道，只看这<span style={{color: C.gold}}>3 步</span></>}><div style={{width: "100%", display: "grid", gap: 23}}>{items.map(([n, heading, detail, color], index) => <div key={n} style={{opacity: steps[index], transform: `translateX(${(1 - steps[index]) * 55}px)`, borderRadius: 26, padding: "28px 30px", background: C.panel, border: `2px solid ${color}88`, display: "flex", alignItems: "center", gap: 22}}><div style={{width: 58, height: 58, borderRadius: "50%", display: "grid", placeItems: "center", background: color, color: C.bg, fontSize: 30, fontWeight: 950}}>{n}</div><div><div style={{fontSize: 36, fontWeight: 900}}>{heading}</div><div style={{fontSize: 25, marginTop: 7, color: C.muted, fontWeight: 650}}>{detail}</div></div></div>)}</div></Scene>; };

const sceneNames = ["hook", "parts", "width", "continuation", "failure", "close"] as const;
const sceneFrames = (name: typeof sceneNames[number]) => Math.ceil((voice[name].durationMs + 260) * fps / 1000);
const durationInFrames = sceneNames.reduce((sum, name) => sum + sceneFrames(name), 0);
const Storyboard: React.FC = () => <Series><Series.Sequence name="开头" durationInFrames={sceneFrames("hook")}><Hook/></Series.Sequence><Series.Sequence name="通道构成" durationInFrames={sceneFrames("parts")}><Parts/></Series.Sequence><Series.Sequence name="通道宽度" durationInFrames={sceneFrames("width")}><Width/></Series.Sequence><Series.Sequence name="有效突破" durationInFrames={sceneFrames("continuation")}><Continuation/></Series.Sequence><Series.Sequence name="失败突破" durationInFrames={sceneFrames("failure")}><Failure/></Series.Sequence><Series.Sequence name="总结" durationInFrames={sceneFrames("close")}><Close/></Series.Sequence></Series>;

export const KeltnerComposition = () => <Composition id="KeltnerExplainer" component={Storyboard} durationInFrames={durationInFrames} fps={fps} width={1080} height={1920}/>;
