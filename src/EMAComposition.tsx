import {
  AbsoluteFill,
  Composition,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Audio} from '@remotion/media';
import {
  deviationFocusIndices,
  deviationMarkers,
  directionMarkers,
  emaDeviationSeries,
  emaDirectionSeries,
  emaResistanceSeries,
  emaSupportSeries,
  getDeviationPercent,
  resistanceMarkers,
  supportMarkers,
  type EmaSeries,
} from './ema-data';

const palette = {
  background: '#070d15',
  panel: '#0c1622',
  grid: '#203142',
  text: '#f3f6fa',
  muted: '#9aabba',
  faint: '#5e7182',
  short: '#ffd166',
  medium: '#5db5ff',
  long: '#b59cff',
  up: '#37d6a2',
  down: '#ff637a',
};

const durationSeconds = {
  opening: 19.44,
  direction: 49.488,
  deviation: 48.264,
  reaction: 60.672,
  close: 24.696,
} as const;

const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";

const weightedCaptions = (captions: string[], speechFrames: number) => {
  const weights = captions.map((caption) => caption.length + ((caption.match(/[，。；：？！]/g) ?? []).length * 2));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return weights.map((weight, index) => {
    const start = cursor;
    cursor += (speechFrames * weight) / total;
    return {text: captions[index], start, end: cursor};
  });
};

const EmaChart: React.FC<{
  data: EmaSeries;
  id: string;
  markerPhase: number;
  reserveSidebar: boolean;
  markers?: Array<{index: number; label: string; color: string}>;
  focusIndices?: number[];
  highlightDeviation?: boolean;
}> = ({data, id, markerPhase, reserveSidebar, markers = [], focusIndices = [], highlightDeviation = false}) => {
  const {width} = useVideoConfig();
  const landscape = width > 1500;
  const viewWidth = landscape ? 1500 : 940;
  // Portrait gets a genuinely vertical chart canvas so it fills the space
  // between the compact heading and the fixed caption instead of leaving an
  // empty block beneath a naturally-sized, almost-square SVG.
  const viewHeight = landscape ? 620 : 1400;
  const margin = landscape
    ? {left: 70, right: reserveSidebar ? 340 : 84, top: 88, bottom: 48}
    : {left: 58, right: 64, top: 116, bottom: 70};
  const plotWidth = viewWidth - margin.left - margin.right;
  const plotHeight = viewHeight - margin.top - margin.bottom;
  const candles = data.candles;
  const allValues = candles.flatMap((candle, index) => [
    candle.high,
    candle.low,
    data.ema7[index],
    data.ema25[index],
    data.ema99[index],
  ]);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const formatPrice = (value: number) => maxValue < 10 ? value.toFixed(3) : value.toFixed(0);
  const padding = (maxValue - minValue) * 0.09;
  const lowBound = minValue - padding;
  const highBound = maxValue + padding;
  const xAt = (index: number) => margin.left + (index / Math.max(1, candles.length - 1)) * plotWidth;
  const yAt = (value: number) => margin.top + ((highBound - value) / (highBound - lowBound)) * plotHeight;
  // Keep the whole price structure visible so the scale never shifts or leaves
  // the unseen future as empty chart space. Narration walks the viewer through
  // one computed event at a time using stable, frame-derived markers.
  const visibleCount = candles.length;
  const activeMarkerIndex = markers.length === 0
    ? -1
    : Math.min(markers.length - 1, Math.floor(markerPhase * markers.length));
  const activeMarker = markers[activeMarkerIndex];
  const playheadIndex = activeMarker?.index ?? Math.min(candles.length - 1, Math.floor(markerPhase * (candles.length - 1)));
  const playheadX = xAt(playheadIndex);
  const playheadY = yAt(candles[playheadIndex].close);
  const step = plotWidth / Math.max(1, candles.length - 1);
  const candleWidth = Math.max(4, step * (landscape ? 0.57 : 0.64));
  const clipId = `ema-clip-${id}`;
  const pricePath = (values: Array<number | null>) => values
    .slice(0, visibleCount)
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(value ?? candles[index].close).toFixed(2)}`)
    .join(' ');
  const deviationAreas = focusIndices.map((focusIndex) => {
    const startIndex = Math.max(0, focusIndex - 4);
    const endIndex = Math.min(candles.length - 1, focusIndex + 4);
    const indexes = Array.from({length: endIndex - startIndex + 1}, (_, index) => startIndex + index);
    return `${indexes.map((index) => `${index === startIndex ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(candles[index].close).toFixed(2)}`).join(' ')} ${indexes.slice().reverse().map((index) => `L ${xAt(index).toFixed(2)} ${yAt(data.ema7[index]).toFixed(2)}`).join(' ')} Z`;
  });
  const dateLabel = (timestamp: number) => {
    const chartTimestamp = data.timeframe === '1小时' ? timestamp + 8 * 60 * 60 * 1000 : timestamp;
    const date = new Date(chartTimestamp);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return data.timeframe === '周线'
      ? `${date.getUTCFullYear()}/${month}`
      : `${month}/${String(date.getUTCDate()).padStart(2, '0')}`;
  };

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      role="img"
      aria-label={`EMA 7、25、99与价格K线`}
      style={{width: '100%', height: '100%', display: 'block', overflow: 'visible'}}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} rx={2} />
        </clipPath>
        <linearGradient id={`${clipId}-wash`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#132537" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0b1420" stopOpacity="0.22" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={viewWidth} height={viewHeight} rx="24" fill={palette.panel} stroke="#223547" strokeWidth="1.5" />
      <g transform={`translate(${viewWidth - margin.right - (landscape ? 475 : 480)}, 29)`} fontFamily={font} fontWeight="600" fontSize={landscape ? 13 : 14}>
        <line x1="0" y1="0" x2="24" y2="0" stroke={palette.short} strokeWidth="4" strokeLinecap="round" />
        <text x="31" y="5" fill={palette.muted}>EMA7</text>
        <line x1="150" y1="0" x2="174" y2="0" stroke={palette.medium} strokeWidth="4" strokeLinecap="round" />
        <text x="181" y="5" fill={palette.muted}>EMA25</text>
        <line x1="315" y1="0" x2="339" y2="0" stroke={palette.long} strokeWidth="4" strokeLinecap="round" />
        <text x="346" y="5" fill={palette.muted}>EMA99</text>
      </g>
      {highlightDeviation && <g fontFamily={font}>
        <rect x={margin.left} y="76" width={landscape ? 348 : 348} height="30" rx="10" fill="#332b18" stroke="#82662c" />
        <text x={margin.left + 12} y="96" fill={palette.short} fontSize={landscape ? 13 : 14} fontWeight="700">乖离率 = (收盘价 − EMA7) ÷ EMA7</text>
      </g>}
      <rect x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} fill={`url(#${clipId}-wash)`} />
      {Array.from({length: 6}, (_, index) => {
        const y = margin.top + (plotHeight * index) / 5;
        const value = highBound - ((highBound - lowBound) * index) / 5;
        return (
          <g key={`hgrid-${index}`}>
            <line x1={margin.left} y1={y} x2={margin.left + plotWidth} y2={y} stroke={palette.grid} strokeWidth="1" />
            <text x={margin.left + plotWidth + 12} y={y + 5} fill={palette.faint} fontFamily={font} fontSize={landscape ? 12 : 14}>{formatPrice(value)}</text>
          </g>
        );
      })}
      {Array.from({length: 9}, (_, index) => {
        const x = margin.left + (plotWidth * index) / 8;
        return <line key={`vgrid-${index}`} x1={x} y1={margin.top} x2={x} y2={margin.top + plotHeight} stroke={palette.grid} strokeWidth="1" opacity="0.42" />;
      })}
      <g clipPath={`url(#${clipId})`}>
        {candles.slice(0, visibleCount).map((candle, index) => {
          const x = xAt(index);
          const bodyTop = yAt(Math.max(candle.open, candle.close));
          const bodyBottom = yAt(Math.min(candle.open, candle.close));
          const rising = candle.close >= candle.open;
          const color = rising ? palette.up : palette.down;
          return (
            <g key={`candle-${id}-${index}`}>
              <line x1={x} y1={yAt(candle.high)} x2={x} y2={yAt(candle.low)} stroke={color} strokeWidth={landscape ? 2 : 2.3} opacity="0.94" />
              <rect
                x={x - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={Math.max(2.4, bodyBottom - bodyTop)}
                rx="1"
                fill={color}
                stroke={color}
                strokeWidth="1"
              />
            </g>
          );
        })}
        {highlightDeviation && deviationAreas.map((area, index) => <path key={`${id}-deviation-area-${index}`} d={area} fill={palette.short} opacity="0.16" />)}
        <path d={pricePath(data.ema99)} fill="none" stroke={palette.long} strokeWidth={landscape ? 3.8 : 4.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.97" />
        <path d={pricePath(data.ema25)} fill="none" stroke={palette.medium} strokeWidth={landscape ? 3.8 : 4.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.98" />
        <path d={pricePath(data.ema7)} fill="none" stroke={palette.short} strokeWidth={landscape ? 3.8 : 4.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.98" />
        {!activeMarker && <g>
          <line x1={playheadX} y1={margin.top} x2={playheadX} y2={margin.top + plotHeight} stroke="#eef5ff" strokeWidth="1.5" strokeDasharray="4 7" opacity="0.3" />
          <line x1={playheadX - 13} y1={playheadY} x2={playheadX + 13} y2={playheadY} stroke="#eef5ff" strokeWidth="2" opacity="0.78" />
          <circle cx={playheadX} cy={playheadY} r="5" fill="#07111b" stroke="#eef5ff" strokeWidth="2" opacity="0.9" />
        </g>}
        {markers.filter((_, markerIndex) => markerIndex === activeMarkerIndex).map(({index, label, color}) => {
          const x = xAt(index);
          const y = yAt(candles[index].close);
          const labelWidth = Math.min(190, label.length * (landscape ? 15 : 16) + 28);
          const left = Math.max(margin.left + 4, Math.min(x - labelWidth / 2, margin.left + plotWidth - labelWidth - 4));
          return (
            <g key={`${id}-marker-${index}`}>
              <line x1={x} y1={margin.top + 4} x2={x} y2={margin.top + plotHeight} stroke={color} strokeWidth="1.5" strokeDasharray="5 8" opacity="0.42" />
              <circle cx={x} cy={y} r={landscape ? 6 : 7} fill={palette.panel} stroke={color} strokeWidth="3" />
              <rect x={left} y={margin.top + 10} width={labelWidth} height={landscape ? 28 : 32} rx="14" fill="#08111c" stroke={`${color}88`} />
              <text x={left + labelWidth / 2} y={margin.top + (landscape ? 29 : 32)} fill={color} fontFamily={font} fontSize={landscape ? 13 : 14} fontWeight="700" textAnchor="middle">{label}</text>
            </g>
          );
        })}
        {highlightDeviation && focusIndices.slice(0, Math.min(focusIndices.length, activeMarkerIndex + 1)).map((focusIndex, index) => {
          const focusX = xAt(focusIndex);
          const focusPriceY = yAt(candles[focusIndex].close);
          const focusEmaY = yAt(data.ema7[focusIndex]);
          const focusPercent = getDeviationPercent(data, focusIndex);
          const labelX = Math.max(margin.left + 4, Math.min(focusX + 14, margin.left + plotWidth - 112));
          const labelY = Math.max(margin.top + 50, Math.min((focusPriceY + focusEmaY) / 2 - 17, margin.top + plotHeight - 38));
          return (
            <g key={`${id}-deviation-focus-${focusIndex}`}>
              <line x1={focusX} y1={focusPriceY} x2={focusX} y2={focusEmaY} stroke={index === 0 ? palette.short : palette.up} strokeWidth="3" />
              <circle cx={focusX} cy={focusPriceY} r="5" fill={index === 0 ? palette.short : palette.up} />
              <circle cx={focusX} cy={focusEmaY} r="5" fill={palette.medium} />
              <rect x={labelX} y={labelY} width="102" height="34" rx="10" fill="#101c29" stroke={index === 0 ? '#82662c' : '#24644f'} />
              <text x={labelX + 51} y={labelY + 22} fill={index === 0 ? palette.short : palette.up} fontFamily={font} fontSize="14" fontWeight="700" textAnchor="middle">+{focusPercent.toFixed(1)}%</text>
            </g>
          );
        })}
      </g>
      <line x1={margin.left} y1={margin.top + plotHeight} x2={margin.left + plotWidth} y2={margin.top + plotHeight} stroke="#34495d" strokeWidth="1.5" />
      <text x={margin.left} y={viewHeight - 18} fill={palette.faint} fontFamily={font} fontSize="12">{dateLabel(data.timestamps[0])}</text>
      <text x={margin.left + plotWidth / 2} y={viewHeight - 18} fill={palette.faint} fontFamily={font} fontSize="12" textAnchor="middle">{dateLabel(data.timestamps[Math.floor(data.timestamps.length / 2)])}</text>
      <text x={margin.left + plotWidth} y={viewHeight - 18} fill={palette.faint} fontFamily={font} fontSize="12" textAnchor="end">{dateLabel(data.timestamps[data.timestamps.length - 1] ?? data.timestamps[0])}</text>
    </svg>
  );
};

type EmaSceneProps = {
  name: string;
  duration: number;
  kicker: string;
  title: string;
  subtitle: string;
  captions: string[];
  data: EmaSeries;
  markers?: Array<{index: number; label: string; color: string}>;
  secondaryData?: EmaSeries;
  secondaryMarkers?: Array<{index: number; label: string; color: string}>;
  focusIndices?: number[];
  highlightDeviation?: boolean;
  sideNotes?: string[];
  secondarySideNotes?: string[];
};

const EmaScene: React.FC<EmaSceneProps> = ({
  name,
  duration,
  kicker,
  title,
  subtitle,
  captions,
  data,
  markers,
  secondaryData,
  secondaryMarkers,
  focusIndices,
  highlightDeviation = false,
  sideNotes = [],
  secondarySideNotes = [],
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const landscape = width > 1500;
  const speechFrames = duration * fps;
  const phase = frame / Math.max(1, speechFrames);
  const captionSegments = weightedCaptions(captions, speechFrames);
  const activeIndex = captionSegments.findIndex(({start, end}) => frame >= start && frame < end);
  const chartCaptionIndex = activeIndex >= 0 ? activeIndex : frame >= speechFrames ? captions.length - 1 : -1;
  const useSecondaryChart = name === '04-support-resistance' && chartCaptionIndex >= 4 && secondaryData !== undefined;
  const activeData = useSecondaryChart ? secondaryData : data;
  const activeMarkers = (useSecondaryChart ? secondaryMarkers : markers) ?? [];
  const activeSideNotes = useSecondaryChart ? secondarySideNotes : sideNotes;
  const supportMarkerForCaption = [0, 0, 0, 1, 0, 0, 0];
  const resistanceMarkerForCaption = [0, 0, 0, 0, 0, 0, 1];
  const directionMarkerForCaption = [0, 0, 1, 2, 2, 2];
  const deviationMarkerForCaption = [0, 0, 1, 1, 1, 2, 3];
  const markerForCaption = name === '04-support-resistance'
    ? useSecondaryChart ? resistanceMarkerForCaption : supportMarkerForCaption
    : name === '02-direction'
      ? directionMarkerForCaption
      : name === '03-deviation'
        ? deviationMarkerForCaption
        : null;
  const chartPhase = markerForCaption && activeMarkers.length > 0 && chartCaptionIndex >= 0
    ? (markerForCaption[chartCaptionIndex] + 0.5) / activeMarkers.length
    : phase;
  const active = activeIndex >= 0 ? captionSegments[activeIndex] : null;
  const captionOpacity = active
    ? interpolate(frame, [active.start, active.start + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const noteIndex = activeSideNotes.length === 0 ? -1 : Math.min(activeSideNotes.length - 1, Math.floor((frame / Math.max(1, speechFrames)) * activeSideNotes.length));
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.background,
        color: palette.text,
        fontFamily: font,
        overflow: 'hidden',
      }}
    >
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 38%, #122436 0%, #070d15 64%)'}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 5, background: 'linear-gradient(90deg, #37d6a2, #5db5ff 52%, #b59cff)'}} />
      <div style={{position: 'relative', zIndex: 1, height: '100%', boxSizing: 'border-box', padding: landscape ? '54px 72px 122px' : '64px 44px 220px', display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30, marginBottom: landscape ? 18 : 8}}>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, color: palette.up, fontSize: landscape ? 17 : 20, letterSpacing: 1.2, fontWeight: 800, marginBottom: landscape ? 8 : 12}}>
              <span style={{display: 'inline-block', width: landscape ? 27 : 34, height: 3, backgroundColor: palette.up}} />
              {kicker}
            </div>
            <div style={{fontSize: landscape ? 50 : 50, lineHeight: 1.13, fontWeight: 800, letterSpacing: 0.1}}>{title}</div>
            <div style={{marginTop: landscape ? 9 : 14, fontSize: landscape ? 22 : 25, color: palette.muted, lineHeight: 1.4, fontWeight: 500}}>{subtitle}</div>
          </div>
        {landscape && <div style={{flexShrink: 0, color: palette.faint, textAlign: 'right', fontSize: 15, lineHeight: 1.65, letterSpacing: 1}}><div>EMA FIELD NOTES</div><div>02 / MOVING AVERAGE</div></div>}
        </div>
        <div style={{flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: landscape ? 'center' : 'flex-start', position: 'relative'}}>
          <EmaChart data={activeData} id={name} markerPhase={chartPhase} reserveSidebar={landscape && activeSideNotes.length > 0} markers={activeMarkers} focusIndices={focusIndices} highlightDeviation={highlightDeviation} />
          {activeSideNotes.length > 0 && landscape && (
            <div style={{position: 'absolute', right: 23, bottom: 23, width: 245, borderRadius: 15, padding: '15px 19px', background: 'rgba(7, 13, 21, .89)', border: '1px solid #2b4053', boxShadow: '0 10px 36px #0007'}}>
              <div style={{fontSize: 13, color: palette.faint, letterSpacing: 1.2, marginBottom: 8}}>看图重点</div>
              <div style={{fontSize: 20, lineHeight: 1.35, fontWeight: 750, color: [palette.short, palette.medium, palette.long][noteIndex % 3]}}>{activeSideNotes[noteIndex]}</div>
            </div>
          )}
        </div>
      </div>
      <div style={{position: 'absolute', zIndex: 3, left: landscape ? 72 : 38, right: landscape ? 72 : 38, bottom: landscape ? 28 : 40, minHeight: landscape ? 66 : 144, boxSizing: 'border-box', padding: landscape ? '12px 24px' : '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: 'rgba(4, 9, 15, .92)', border: '1px solid #283d51', borderRadius: landscape ? 16 : 22, color: palette.text, fontSize: landscape ? 25 : 32, fontWeight: 650, lineHeight: 1.35, opacity: captionOpacity}}>
        {active?.text ?? ''}
      </div>
      <Audio src={staticFile(`episodes/ema/voiceover/${name}.wav`)} premountFor={fps} />
    </AbsoluteFill>
  );
};

const Opening = () => <EmaScene
  name="01-opening"
  duration={durationSeconds.opening}
  kicker="一个指标，三个观察角度"
  title="如果只能留一个，我会选 EMA"
  subtitle="趋势方向 · 乖离 · 回调后的价格反应"
  captions={[
    '如果图表上只能留一个指标，我会留 EMA。',
    '不是因为它能告诉你明天涨还是跌，',
    '它能帮你看清三个问题：趋势、乖离、回调后的反应。',
  ]}
  data={emaDirectionSeries}
  sideNotes={['趋势往哪边走？', '价格是不是离得太远？', '回调后有没有转强？']}
/>

const Direction = () => <EmaScene
  name="02-direction"
  duration={durationSeconds.direction}
  kicker="01 / 看趋势方向"
  title="短线先变，中线再确认"
  subtitle="短期走弱，和中期趋势转向，不是一回事。"
  captions={[
    '先说第一个作用：看趋势方向。',
    '用 7、25、99，分别看短、中、长周期。价格从回踩后走出一段上涨，短期线先抬起，25 和 99 随后跟上。',
    '冲高后，价格先跌回短期 EMA 下方，短期走弱；但中期 EMA 还在上行，不能因为短线回落就说中期转弱。',
    '再看右边，价格继续下探，中期 EMA 由上行转平，再向下；价格收在它下方，中期走势也开始转弱。',
    '长期 EMA 仍向上，变化最慢，提供更长周期的背景。',
    '短线看变化，中线看确认，长线看方向。',
  ]}
  data={emaDirectionSeries}
  markers={directionMarkers}
  sideNotes={['短期 EMA 先拐头', '中期 EMA 看变化是否扩大', '长期 EMA 看趋势背景']}
/>

const Deviation = () => <EmaScene
  name="03-deviation"
  duration={durationSeconds.deviation}
  kicker="02 / 看价格离得多远"
  title="乖离变大，别急着追"
  subtitle="偏离过大可能均值回归，持仓可考虑部分止盈。"
  captions={[
    '第二个作用：看乖离。',
    '先看左边第一波急涨，收盘价一度比 EMA7 高出约 11.9%，价格和均线明显拉开。',
    '右边后来又冲了一次，乖离也有约 6.7%。两次加速都说明短线跑得很快；',
    '还没进场的，别只因为涨得快就追。',
    '乖离偏大，价格可能向均值回归；已经持仓，可以考虑分批止盈一部分。',
    '再看后面，价格先跌回 EMA7 下方，继续回落后又跌破 EMA25。',
    '接下来要看价格能不能企稳、重新站上 EMA25；如果始终站不回去，回落还可能继续。',
  ]}
  data={emaDeviationSeries}
  focusIndices={deviationFocusIndices}
  markers={deviationMarkers}
  highlightDeviation
  sideNotes={['第一波乖离：+11.9%', '第二波乖离：+6.7%', '再看价格能否企稳']}
/>

const Reaction = () => <EmaScene
  name="04-support-resistance"
  duration={durationSeconds.reaction}
  kicker="03 / 看均线附近的反应"
  title="回调和反弹，均线附近看什么？"
  subtitle="回调看有没有买盘接住，反弹看卖压会不会再出现。"
  captions={[
    '第三个作用：看均线附近，价格怎样反应。',
    '先看这段回调。价格回落到上行的 EMA25 附近，一度下探，收盘重新回到线附近，随后继续走高。',
    '为什么会有买盘？持仓的人看到均线附近守住，可能继续持有或加仓；等回调的人也可能把这里当作关注区域。',
    '买盘在均线附近接住卖盘，价格随后走高，支撑就来自这轮真实的买卖反应。',
    '再看另一个例子。下行过程中，价格反弹到向下的 EMA99 附近，但收盘仍在线下。',
    '为什么这里会有卖压？上方买入的人等价格反弹回来，可能选择离场；看空的人也可能趁反弹卖出。',
    '卖盘把价格压回均线下，之后低点继续下移，均线附近就形成了阻力。',
  ]}
  data={emaSupportSeries}
  markers={supportMarkers}
  sideNotes={['回撤靠近 EMA25', '收盘守住后继续走高', '买盘承接卖盘']}
  secondaryData={emaResistanceSeries}
  secondaryMarkers={resistanceMarkers}
  secondarySideNotes={['EMA99 向下倾斜', '反弹接近 EMA99', '之后低点继续下移']}
/>

const Close = () => <EmaScene
  name="05-close"
  duration={durationSeconds.close}
  kicker="看方向 · 看乖离 · 等确认"
  title="让价格走出来，再做判断"
  subtitle="短、中、长期 EMA，给你一套连续的观察顺序。"
  captions={[
    '所以，EMA 不只是看“价格在线上还是线下”。',
    '看方向，观察短中长周期的变化；乖离过大时，留意均值回归，持仓可以考虑部分止盈；',
    '看支撑阻力，观察价格回到均线附近后的买卖反应。',
    '用 EMA，不是预测下一步，而是等价格走出来，再做确认。',
  ]}
  data={emaSupportSeries}
  sideNotes={['趋势变化', '乖离参考', '回调确认']}
/>

const EmaVideo: React.FC = () => {
  const {fps} = useVideoConfig();
  const breath = Math.round(0.35 * fps);
  return (
    <Series>
      <Series.Sequence name="开场：三个问题" durationInFrames={Math.ceil(durationSeconds.opening * fps) + breath} premountFor={fps}><Opening /></Series.Sequence>
      <Series.Sequence name="方向：短中长线索" durationInFrames={Math.ceil(durationSeconds.direction * fps) + breath} premountFor={fps}><Direction /></Series.Sequence>
      <Series.Sequence name="乖离变大：留意均值回归" durationInFrames={Math.ceil(durationSeconds.deviation * fps) + breath} premountFor={fps}><Deviation /></Series.Sequence>
      <Series.Sequence name="支撑阻力：看价格反应" durationInFrames={Math.ceil(durationSeconds.reaction * fps) + breath} premountFor={fps}><Reaction /></Series.Sequence>
      <Series.Sequence name="收尾：交易确认" durationInFrames={Math.ceil(durationSeconds.close * fps) + breath} premountFor={fps}><Close /></Series.Sequence>
    </Series>
  );
};

const totalFrames = (fps: number) => Math.ceil(Object.values(durationSeconds).reduce((sum, duration) => sum + duration, 0) * fps) + (Math.round(0.35 * fps) * 5);

export const EMAComposition = () => (
  <Composition id="EMAExplainer" component={EmaVideo} durationInFrames={totalFrames(30)} fps={30} width={1080} height={1920} />
);

export const EMALandscapeComposition = () => (
  <Composition id="EMAExplainerLandscape" component={EmaVideo} durationInFrames={totalFrames(30)} fps={30} width={1920} height={1080} />
);
