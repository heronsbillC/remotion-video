import React from "react";
import {Easing, interpolate, useVideoConfig} from "remotion";
import {calculateSMA, calculateSupertrend, createCandles, type Candle, type SupertrendPoint} from "./supertrend-data";

const palette = {
  panel: "#0b1925",
  grid: "#213443",
  text: "#e8f0f5",
  muted: "#8da3b2",
  green: "#54d6ad",
  red: "#ef8293",
  blue: "#8da7ff",
  yellow: "#d5e67c",
};

const datasets = {
  pullback: createCandles("pullback", 74),
  story: createCandles("story", 74),
  trend: createCandles("trend", 74),
  reversal: createCandles("reversal", 74),
  range: createCandles("range", 74),
  volatility: createCandles("volatility", 74),
};

const indicators = Object.fromEntries(
  Object.entries(datasets).map(([key, candles]) => [key, calculateSupertrend(candles, 10, 3)]),
) as Record<keyof typeof datasets, SupertrendPoint[]>;
const averages = Object.fromEntries(
  Object.entries(datasets).map(([key, candles]) => [key, calculateSMA(candles, 20)]),
) as Record<keyof typeof datasets, Array<number | null>>;

type ChartProps = {
  readonly data?: Candle[];
  readonly indicator?: SupertrendPoint[];
  readonly movingAverage?: Array<number | null>;
  readonly frame: number;
  readonly height?: number;
  readonly showSupertrend?: boolean;
  readonly showBands?: boolean;
  readonly revealSeconds?: number;
  readonly playheadSeconds?: number;
  readonly indicatorRevealSeconds?: number;
  readonly compact?: boolean;
  readonly highlightFlipAfter?: number;
  readonly annotatePullback?: boolean;
};

export const GeneratedCandlestickChart: React.FC<ChartProps> = ({
  data = datasets.pullback,
  indicator,
  movingAverage,
  frame,
  height = 570,
  showSupertrend = false,
  showBands = false,
  revealSeconds = 8,
  playheadSeconds,
  indicatorRevealSeconds,
  compact = false,
  highlightFlipAfter,
  annotatePullback = false,
}) => {
  const {fps, width: videoWidth} = useVideoConfig();
  const landscape = videoWidth > 1400;
  const chartWidth = landscape && !compact ? 1500 : 940;
  const chartHeight = compact ? (landscape ? 450 : 330) : 560;
  const left = landscape && !compact ? 86 : 58;
  const right = chartWidth - (landscape && !compact ? 94 : 85);
  const top = compact ? 24 : 54;
  const bottom = compact ? (landscape ? 400 : 280) : 496;
  const visible = revealSeconds <= 0 ? data.length : Math.max(2, Math.min(data.length, Math.floor(interpolate(
    frame,
    [0, revealSeconds * fps],
    [2, data.length],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1)},
  ))));
  const overlayVisible = indicatorRevealSeconds === undefined || indicatorRevealSeconds <= 0
    ? visible
    : Math.max(2, Math.min(data.length, Math.floor(interpolate(
      frame,
      [0, indicatorRevealSeconds * fps],
      [2, data.length],
      {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1)},
    ))));
  const visibleBars = data.slice(0, visible);
  const visibleIndicator = indicator?.slice(0, showSupertrend ? overlayVisible : visible) ?? [];
  const visibleAverage = movingAverage?.slice(0, visible) ?? [];
  const clipId = data === datasets.trend ? "plot-clip-trend" : data === datasets.range ? "plot-clip-range" : data === datasets.reversal ? "plot-clip-reversal" : "plot-clip-default";
  const flipIndex = indicator?.findIndex((point, index) => index > 0 && point.direction !== null && indicator[index - 1].direction !== null && point.direction !== indicator[index - 1].direction) ?? -1;
  const showFlip = showSupertrend && flipIndex >= 0 && visible > flipIndex && (highlightFlipAfter === undefined || frame >= highlightFlipAfter);
  const values = visibleBars.flatMap((bar) => [bar.high, bar.low]);
  indicator?.forEach((point) => point.value !== null && values.push(point.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.12, 1);
  const yMin = min - padding;
  const yMax = max + padding;
  const xFor = (index: number) => left + (index / Math.max(data.length - 1, 1)) * (right - left);
  const yFor = (value: number) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);
  const step = (right - left) / Math.max(data.length - 1, 1);
  const bodyWidth = Math.max(compact ? 4 : 5, Math.min(compact ? 8 : 10, step * 0.56));
  const scaleTicks = Array.from({length: 5}, (_, index) => yMin + ((yMax - yMin) * index) / 4);
  const progressedIndex = showSupertrend && indicatorRevealSeconds !== undefined && indicatorRevealSeconds > 0 ? overlayVisible - 1 : visible - 1;
  const activeIndex = Math.max(0, playheadSeconds !== undefined && playheadSeconds > 0
    ? Math.floor(interpolate(frame, [0, playheadSeconds * fps], [0, data.length - 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}))
    : progressedIndex);
  const activeBar = data[activeIndex];
  const activePoint = indicator?.[activeIndex];
  const pullbackTroughIndex = annotatePullback
    ? data.reduce((lowest, candle, index) => (index > 27 && index < 52 && candle.low < data[lowest].low ? index : lowest), 27)
    : -1;
  const pullbackVisible = annotatePullback && showSupertrend && overlayVisible > pullbackTroughIndex;

  const makeSegments = (direction: 1 | -1) => {
    const points = visibleIndicator
      .map((point, index) => ({point, index}))
      .filter(({point}) => point.value !== null && point.direction === direction);
    const segments: string[] = [];
    let current = "";
    let previousIndex = -2;
    for (const {point, index} of points) {
      if (point.value === null) continue;
      const x = xFor(index);
      const y = yFor(point.value);
      if (index !== previousIndex + 1 && current) {
        segments.push(current);
        current = "";
      }
      current += current ? ` H ${x.toFixed(1)} V ${y.toFixed(1)}` : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      previousIndex = index;
    }
    if (current) segments.push(current);
    return segments;
  };

  const displayHeight = landscape ? compact ? 420 : 680 : height;
  return (
    <div style={{width: "100%", height: displayHeight, border: landscape ? "none" : "1px solid #253b4b", borderRadius: landscape ? 0 : 20, background: landscape ? "transparent" : palette.panel, padding: landscape ? 0 : compact ? 8 : 14, boxSizing: "border-box", boxShadow: landscape ? "none" : "0 18px 42px #0005"}}>
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%" style={{display: "block"}} role="img" aria-label="根据合成行情生成的K线图">
        <defs><clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath></defs>
        {scaleTicks.map((tick, index) => {
          const y = yFor(tick);
          return <g key={index}>
            <line x1={left} x2={right} y1={y} y2={y} stroke={palette.grid} strokeWidth="1" />
            {!compact && <text x={chartWidth - 16} y={y + 5} fill={palette.muted} fontSize="16" textAnchor="end">{tick.toFixed(1)}</text>}
          </g>;
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const x = left + (right - left) * fraction;
          return <line key={fraction} x1={x} x2={x} y1={top} y2={bottom} stroke={palette.grid} strokeWidth="1" opacity="0.48" />;
        })}
        <g clipPath={`url(#${clipId})`}>
          {visibleBars.map((bar, index) => {
            const x = xFor(index);
            const up = bar.close >= bar.open;
            const color = up ? palette.green : palette.red;
            const bodyY = yFor(Math.max(bar.open, bar.close));
            const bodyBottom = yFor(Math.min(bar.open, bar.close));
            return <g key={index}>
              <line x1={x} x2={x} y1={yFor(bar.high)} y2={yFor(bar.low)} stroke={color} strokeWidth={compact ? 1.5 : 2} />
              <rect x={x - bodyWidth / 2} y={bodyY} width={bodyWidth} height={Math.max(2, bodyBottom - bodyY)} fill={up ? `${color}22` : color} stroke={color} strokeWidth="1.5" rx="1" />
            </g>;
          })}
          {showBands && <>
            {(["upper", "lower"] as const).map((band) => {
              const points = visibleIndicator.map((point, index) => ({value: point[band], index})).filter(({value}) => value !== null);
              const d = points.map(({value, index}, pointIndex) => `${pointIndex === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value as number).toFixed(1)}`).join(" ");
              return <path key={band} d={d} fill="none" stroke={palette.blue} strokeWidth="2.5" strokeDasharray="7 8" opacity="0.58" />;
            })}
          </>}
          {showSupertrend && makeSegments(1).map((path, index) => <path key={`up-${index}`} d={path} fill="none" stroke={palette.green} strokeWidth={compact ? 3 : 4} strokeLinecap="round" strokeLinejoin="round" />)}
          {showSupertrend && makeSegments(-1).map((path, index) => <path key={`down-${index}`} d={path} fill="none" stroke={palette.red} strokeWidth={compact ? 3 : 4} strokeLinecap="round" strokeLinejoin="round" />)}
          {visibleAverage.length > 0 && <path
            d={visibleAverage.map((value, index) => value === null ? "" : `${index === 0 || visibleAverage[index - 1] === null ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).filter(Boolean).join(" ")}
            fill="none" stroke={palette.blue} strokeWidth={compact ? 2.5 : 3.4} strokeDasharray="9 7" strokeLinecap="round" opacity="0.95"
          />}
          {visible > 1 && <g opacity="0.48">
            <line x1={xFor(activeIndex)} x2={xFor(activeIndex)} y1={top} y2={bottom} stroke="#dce8f0" strokeWidth="1.5" strokeDasharray="4 7" />
          </g>}
          {activeBar && <circle cx={xFor(activeIndex)} cy={yFor(activeBar.close)} r={compact ? 4 : 6} fill={palette.text} stroke={activeBar.close >= activeBar.open ? palette.green : palette.red} strokeWidth="3" />}
          {showFlip && <g>
            <line x1={xFor(flipIndex)} x2={xFor(flipIndex)} y1={top} y2={bottom} stroke={palette.yellow} strokeWidth="2" strokeDasharray="5 7" opacity="0.75" />
            <circle cx={xFor(flipIndex)} cy={yFor(data[flipIndex].close)} r="8" fill={palette.yellow} stroke={palette.panel} strokeWidth="3" />
            <rect x={Math.min(right - 152, xFor(flipIndex) + 15)} y={Math.max(top + 8, yFor(data[flipIndex].close) - 46)} width="143" height="36" rx="9" fill="#172633" stroke={palette.yellow} strokeWidth="1.5" />
            <text x={Math.min(right - 80, xFor(flipIndex) + 87)} y={Math.max(top + 32, yFor(data[flipIndex].close) - 22)} textAnchor="middle" fill={palette.yellow} fontSize="19" fontWeight="700">收盘破线 · 翻边</text>
          </g>}
          {pullbackVisible && <g>
            <circle cx={xFor(pullbackTroughIndex)} cy={yFor(data[pullbackTroughIndex].low)} r="7" fill={palette.yellow} stroke={palette.panel} strokeWidth="3" />
            <path d={`M ${xFor(pullbackTroughIndex)} ${yFor(data[pullbackTroughIndex].low) - 8} L ${xFor(pullbackTroughIndex) - 14} ${yFor(data[pullbackTroughIndex].low) - 50}`} stroke={palette.yellow} strokeWidth="2" />
            <rect x={Math.max(left + 4, xFor(pullbackTroughIndex) - 196)} y={Math.max(top + 8, yFor(data[pullbackTroughIndex].low) - 102)} width="190" height="47" rx="10" fill="#172633" stroke={palette.yellow} strokeWidth="1.5" />
            <text x={Math.max(left + 99, xFor(pullbackTroughIndex) - 101)} y={Math.max(top + 37, yFor(data[pullbackTroughIndex].low) - 73)} textAnchor="middle" fill={palette.yellow} fontSize="19" fontWeight="700">深回撤 · 收盘仍守在线上</text>
          </g>}
        </g>
        <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#607887" strokeWidth="1.3" />
        {!compact && showSupertrend && <g>
          <rect x={left + 8} y={top + 8} width="258" height="60" rx="12" fill="#101f2b" stroke="#2a4151" />
          <text x={left + 22} y={top + 32} fill={palette.muted} fontSize="17" fontWeight="600">当前收盘</text>
          <text x={left + 22} y={top + 54} fill={palette.text} fontSize="22" fontWeight="750">{activeBar?.close.toFixed(2)}</text>
          {activePoint?.atr !== null && activePoint?.atr !== undefined && <>
            <text x={left + 142} y={top + 32} fill={palette.muted} fontSize="17" fontWeight="600">ATR</text>
            <text x={left + 142} y={top + 54} fill={palette.yellow} fontSize="22" fontWeight="750">{activePoint.atr.toFixed(2)}</text>
          </>}
        </g>}
        {!compact && <>
          <text x={left} y="537" fill={palette.muted} fontSize="19">左侧 · 更早</text>
          <text x={right} y="537" fill={palette.muted} fontSize="19" textAnchor="end">最新K线</text>
          <text x="72" y="32" fill={palette.muted} fontSize="18">合成行情 · 规则演示</text>
        </>}
      </svg>
    </div>
  );
};

export const ChartData = datasets;
export const ChartIndicators = indicators;
export const ChartAverages = averages;

export const ATRFormulaVisual: React.FC<{readonly frame: number}> = ({frame}) => {
  const {fps} = useVideoConfig();
  const formulaProgress = interpolate(frame, [fps * 2, fps * 5], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1, 0.36, 1)});

  return <div style={{display: "grid", gap: 14}}>
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", color: palette.muted, fontSize: 20, fontWeight: 650, letterSpacing: 0.4}}>
      <span>虚线是上下带，实线是当前 Supertrend</span><span style={{color: palette.yellow}}>波幅放大，带子拉宽</span>
    </div>
    <GeneratedCandlestickChart data={datasets.volatility} indicator={indicators.volatility} frame={frame} height={555} showSupertrend showBands revealSeconds={12.5} indicatorRevealSeconds={12.5} />
    <div style={{border: "1px solid #2a4151", borderRadius: 15, background: "#0b1925", padding: "13px 20px", opacity: formulaProgress}}>
      <div style={{display: "grid", gridTemplateColumns: "1.25fr 0.75fr", gap: 6, color: palette.text, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 21, lineHeight: 1.4}}>
        <span>TR = max(H−L, |H−C₋₁|, |L−C₋₁|)</span><span style={{color: palette.yellow}}>ATR = RMA(TR, 10)</span>
        <span style={{gridColumn: "1 / -1", color: palette.blue}}>上下基础带 = (H+L) ÷ 2 ± 3 × ATR</span>
      </div>
    </div>
  </div>;
};

export const BandFormulaVisual: React.FC = () => (
  <div style={{display: "grid", gap: 16}}>
    <div style={{border: "1px solid #2a4151", borderRadius: 18, background: palette.panel, padding: "21px 25px"}}>
      <div style={{color: palette.muted, fontSize: 20, marginBottom: 8}}>先算出两条基础带</div>
      <div style={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: palette.text, fontSize: 26, lineHeight: 1.55}}>中点 = (H + L) ÷ 2</div>
      <div style={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: palette.green, fontSize: 26, lineHeight: 1.55}}>上带 = 中点 + 3 × ATR</div>
      <div style={{fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: palette.red, fontSize: 26, lineHeight: 1.55}}>下带 = 中点 − 3 × ATR</div>
    </div>
    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16}}>
      {[{name: "ATR较小", width: 38, color: palette.blue}, {name: "ATR较大", width: 72, color: palette.yellow}].map((item) => <div key={item.name} style={{border: "1px solid #2a4151", borderRadius: 18, background: palette.panel, padding: 18}}>
        <div style={{fontSize: 21, fontWeight: 700, color: item.color, marginBottom: 20}}>{item.name}</div>
        <div style={{height: 110, position: "relative", display: "flex", alignItems: "center", justifyContent: "center"}}>
          <div style={{position: "absolute", left: "15%", right: "15%", height: 1, background: "#607887"}} />
          <div style={{width: 2, height: item.width, background: item.color, boxShadow: `0 0 18px ${item.color}66`}} />
          <span style={{position: "absolute", left: "15%", top: `calc(50% - ${item.width / 2}px - 9px)`, width: "70%", borderTop: `2px solid ${item.color}`}} />
          <span style={{position: "absolute", left: "15%", top: `calc(50% + ${item.width / 2}px + 7px)`, width: "70%", borderTop: `2px solid ${item.color}`}} />
        </div>
        <div style={{textAlign: "center", color: palette.muted, fontSize: 17}}>波动越大，基础带越宽</div>
      </div>)}
    </div>
  </div>
);

export const TrendRangeComparison: React.FC<{readonly frame: number}> = ({frame}) => {
  const {fps, width} = useVideoConfig();
  const landscape = width > 1400;
  const rangeFlips = indicators.range.reduce((count, point, index) => (
    count + (index > 0 && point.direction !== null && indicators.range[index - 1].direction !== null && point.direction !== indicators.range[index - 1].direction ? 1 : 0)
  ), 0);
  const revealedRangeFlips = indicators.range.reduce((count, point, index) => (
    count + (index > 0 && index < Math.floor((Math.max(0, frame - fps * 1.5) / (fps * 12.5)) * datasets.range.length) && point.direction !== null && indicators.range[index - 1].direction !== null && point.direction !== indicators.range[index - 1].direction ? 1 : 0)
  ), 0);
  return <div style={{display: "grid", gridTemplateColumns: landscape ? "1fr 1fr" : "1fr", gap: 18}}>
    <div style={{border: "1px solid #2a4151", borderRadius: 18, background: palette.panel, padding: "12px 14px 8px"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 10px"}}>
        <span style={{color: palette.green, fontSize: 22, fontWeight: 750}}>趋势行情</span>
        <span style={{color: palette.muted, fontSize: 17}}>线跟随上行，回撤时仍给价格空间</span>
      </div>
      <GeneratedCandlestickChart data={datasets.trend} indicator={indicators.trend} frame={frame} height={landscape ? 420 : 390} showSupertrend revealSeconds={12.5} compact />
    </div>
    <div style={{border: "1px solid #2a4151", borderRadius: 18, background: palette.panel, padding: "12px 14px 8px"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 10px"}}>
        <span style={{color: palette.yellow, fontSize: 22, fontWeight: 750}}>震荡行情</span>
        <span style={{color: palette.yellow, fontSize: 17, fontWeight: 750}}>已翻边 {Math.min(rangeFlips, revealedRangeFlips)} 次</span>
      </div>
      <GeneratedCandlestickChart data={datasets.range} indicator={indicators.range} frame={Math.max(0, frame - fps * 1.5)} height={landscape ? 420 : 390} showSupertrend revealSeconds={12.5} compact />
    </div>
  </div>;
};
