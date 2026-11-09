import {Audio} from '@remotion/media';
import type {Caption} from '@remotion/captions';
import {
  AbsoluteFill,
  Composition,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {CSSProperties, ReactNode} from 'react';
import openingCaptions from '../episodes/macd/captions/01-opening.json';
import portraitOpeningCaptions from '../episodes/macd/captions/01-opening-portrait.json';
import componentsCaptions from '../episodes/macd/captions/02-components.json';
import portraitComponentsCaptions from '../episodes/macd/captions/02-components-portrait.json';
import zeroCaptions from '../episodes/macd/captions/03-zero-line.json';
import crossCaptions from '../episodes/macd/captions/04-crossovers.json';
import histogramCaptions from '../episodes/macd/captions/05-histogram.json';
import portraitHistogramCaptions from '../episodes/macd/captions/05-histogram-portrait.json';
import divergenceCaptions from '../episodes/macd/captions/06-divergence.json';
import closeCaptions from '../episodes/macd/captions/07-close.json';
import voiceDurations from '../episodes/macd/durations.json';
import portraitVoiceDurations from '../episodes/macd/portrait-durations.json';
import {crossExamples, divergencePeaks, firstPositiveShrinkingRun, macdSeries} from './macd-data';
import {portraitCrossExamples, portraitMacdSeries, portraitZeroExamples} from './macd-portrait-data';
import {
  portraitMomentumSeries,
  redExpandingBars,
  shrinkingBars,
} from './macd-portrait-momentum-data';
import {
  componentsSeries,
  divergenceSeries as teachingDivergenceSeries,
  hookReexpandingBars,
  hookShrinkingBars,
  hookSeries,
  summarySeries,
} from './macd-teaching-data';

const C = {
  bg: '#07111c',
  panel: '#0c1622',
  panel2: '#101e2c',
  grid: '#23384b',
  text: '#f3f6fa',
  muted: '#9aabba',
  faint: '#617688',
  green: '#37d6a2',
  red: '#ff637a',
  blue: '#5db5ff',
  yellow: '#ffd166',
  purple: '#b59cff',
};

const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
const totalSeconds = Object.values(voiceDurations).reduce((sum, duration) => sum + duration, 0) + 7 * 0.28;
const portraitDurations = portraitVoiceDurations as Record<string, number>;

type SceneId = '01-opening' | '02-components' | '03-zero-line' | '04-crossovers' | '05-histogram' | '06-divergence' | '07-close';
type SceneConfig = {
  id: SceneId;
  kicker: string;
  title: ReactNode;
  subtitle: string;
  captions: Caption[];
  mode: 'opening' | 'components' | 'zero' | 'crosses' | 'histogram' | 'divergence' | 'close';
};

const scenes: SceneConfig[] = [
  {
    id: '01-opening',
    kicker: '一个持仓问题',
    title: <>MACD柱子变短，<br /><span style={{color: C.green}}>行情还在涨</span></> as ReactNode,
    subtitle: '这时候，该不该卖？',
    captions: openingCaptions as Caption[],
    mode: 'opening',
  },
  {
    id: '02-components',
    kicker: '先看懂它在画什么',
    title: <>三样东西，<span style={{color: C.blue}}>看动能变化</span></> as ReactNode,
    subtitle: '快线 · 信号线 · 柱体',
    captions: componentsCaptions as Caption[],
    mode: 'components',
  },
  {
    id: '03-zero-line',
    kicker: '先分清偏多还是偏空',
    title: <>零轴是多空背景的<span style={{color: C.yellow}}>分界</span></> as ReactNode,
    subtitle: '短期均线高于长期均线，MACD快线在零轴上方；反过来就在下方。',
    captions: zeroCaptions as Caption[],
    mode: 'zero',
  },
  {
    id: '04-crossovers',
    kicker: '金叉死叉要看位置',
    title: <>同样的交叉，<span style={{color: C.green}}>含义不同</span></> as ReactNode,
    subtitle: '零轴上方 · 零轴下方',
    captions: crossCaptions as Caption[],
    mode: 'crosses',
  },
  {
    id: '05-histogram',
    kicker: '回到开头那段走势',
    title: <>正柱缩短，<span style={{color: C.yellow}}>上行动能放慢</span></> as ReactNode,
    subtitle: '价格仍在上涨，柱体变化先出现。',
    captions: histogramCaptions as Caption[],
    mode: 'histogram',
  },
  {
    id: '06-divergence',
    kicker: '价格与动能没有同步',
    title: <>价格创新高，MACD<span style={{color: C.red}}>没跟上</span></> as ReactNode,
    subtitle: '这就是顶背离：提醒上涨动能可能减弱。',
    captions: divergenceCaptions as Caption[],
    mode: 'divergence',
  },
  {
    id: '07-close',
    kicker: '把几个观察点放回一张图',
    title: <>零轴、柱体、<span style={{color: C.green}}>价格走势</span></> as ReactNode,
    subtitle: '一起看，才知道信号发生在什么位置。',
    captions: closeCaptions as Caption[],
    mode: 'close',
  },
];

const crossNarrationOrder = [
  crossExamples.find((event) => event.kind === 'golden' && event.zone === 'above')!,
  crossExamples.find((event) => event.kind === 'death' && event.zone === 'above')!,
  crossExamples.find((event) => event.kind === 'death' && event.zone === 'below')!,
  crossExamples.find((event) => event.kind === 'golden' && event.zone === 'below')!,
];

const zeroForChart = (value: number, min: number, max: number, top: number, bottom: number) => (
  top + ((max - value) / (max - min)) * (bottom - top)
);

const MacdChart: React.FC<{
  mode: SceneConfig['mode'];
  progress: number;
  landscape: boolean;
}> = ({mode, progress, landscape}) => {
  // Only the hook and the later histogram lesson are one continuous case.
  // Other concepts need their own readable market regime instead of forcing
  // every scene to reuse one crowded chart silhouette.
  const hookCase = !landscape && (mode === 'opening' || mode === 'histogram');
  const signalCase = !landscape && (mode === 'zero' || mode === 'crosses');
  const series = landscape
    ? macdSeries
    : hookCase
      ? hookSeries
      : signalCase
        ? portraitMacdSeries
        : mode === 'components'
          ? componentsSeries
          : mode === 'divergence'
            ? teachingDivergenceSeries
            : mode === 'close'
              ? summarySeries
              : portraitMomentumSeries;
  const crossExamplesForView = signalCase ? portraitCrossExamples : crossExamples;
  const zeroExamplesForView = signalCase ? portraitZeroExamples : {bullish: 20, bearish: 67};
  // The portrait divergence chart is a separate deliberately-shaped example:
  // its two displayed highs are at different locations from the landscape data.
  const divergenceForView = !landscape && mode === 'divergence'
    ? {first: 14, second: 36}
    : divergencePeaks;
  const width = landscape ? 1680 : 940;
  const height = landscape ? 700 : 1300;
  const margin = landscape ? {left: 66, right: 34} : {left: 55, right: 24};
  const plotWidth = width - margin.left - margin.right;
  const priceTop = landscape ? 92 : 112;
  const priceBottom = landscape ? 400 : 690;
  const macdTop = landscape ? 485 : 820;
  const macdBottom = landscape ? 646 : 1214;
  const candles = series.candles;
  const xAt = (index: number) => margin.left + (index / (candles.length - 1)) * plotWidth;
  const priceValues = candles.flatMap(({high, low}) => [high, low]);
  const minPrice = Math.min(...priceValues) * 0.985;
  const maxPrice = Math.max(...priceValues) * 1.015;
  const yPrice = (value: number) => zeroForChart(value, minPrice, maxPrice, priceTop, priceBottom);
  const maxMacd = Math.max(...series.macd.map(Math.abs), ...series.histogram.map(Math.abs), ...series.signal.map(Math.abs)) * 1.18;
  const yMacd = (value: number) => zeroForChart(value, -maxMacd, maxMacd, macdTop, macdBottom);
  const step = plotWidth / candles.length;
  const candleWidth = Math.max(3.3, step * (landscape ? 0.58 : 0.55));
  const activeCaption = mode === 'crosses'
    ? Math.min(3, Math.floor(progress * 4))
    : 0;
  const crossOrder = landscape ? crossNarrationOrder : [
    crossExamplesForView.find((event) => event.kind === 'golden' && event.zone === 'above')!,
    crossExamplesForView.find((event) => event.kind === 'death' && event.zone === 'above')!,
    crossExamplesForView.find((event) => event.kind === 'death' && event.zone === 'below')!,
    crossExamplesForView.find((event) => event.kind === 'golden' && event.zone === 'below')!,
  ];
  const activeCross = crossOrder[activeCaption];
  const histogramRange = !landscape && mode === 'histogram' && progress >= 0.48 ? hookReexpandingBars : hookShrinkingBars;
  const histogramReveal = mode === 'opening' ? progress : mode === 'histogram'
    ? interpolate(progress, [histogramRange === hookShrinkingBars ? 0.04 : 0.52, histogramRange === hookShrinkingBars ? 0.46 : 0.94], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const summaryStage = Math.min(3, Math.floor(progress * 4));
  const summaryCross = crossOrder.find((event) => event.kind === 'golden' && event.zone === 'above')!;
  const fastLineProgress = interpolate(progress, [0.02, 0.36], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const signalLineProgress = interpolate(progress, [0.38, 0.68], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const histogramProgress = interpolate(progress, [0.7, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const focusRange = mode === 'histogram' ? histogramRange : !landscape && mode === 'opening' ? hookShrinkingBars : firstPositiveShrinkingRun;
  const focusProgress = mode === 'histogram'
    ? progress < 0.48
      ? interpolate(progress, [0, 0.48], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
      : interpolate(progress, [0.48, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : progress;
  const summaryHistogramProgress = interpolate(progress, [0.5, 0.75], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const focusIndex = mode === 'opening' || mode === 'histogram'
    ? Math.round(interpolate(focusProgress, [0, 1], [focusRange.start, focusRange.end], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))
    : mode === 'zero'
      ? progress < 0.5 ? zeroExamplesForView.bullish : zeroExamplesForView.bearish
      : mode === 'crosses'
        ? activeCross.index
        : mode === 'divergence'
          ? progress < 0.56 ? divergenceForView.first : divergenceForView.second
          : Math.round(interpolate(progress, [0, 1], [6, candles.length - 6], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const baseline = yMacd(0);
  const macdPath = series.macd.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yMacd(value).toFixed(2)}`).join(' ');
  const signalPath = series.signal.map((value, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yMacd(value).toFixed(2)}`).join(' ');
  const openingX0 = xAt(mode === 'opening' || mode === 'histogram' ? focusRange.start : firstPositiveShrinkingRun.start);
  const openingX1 = xAt(mode === 'opening' || mode === 'histogram' ? focusRange.end : firstPositiveShrinkingRun.end);
  const divergenceX0 = xAt(divergenceForView.first);
  const divergenceX1 = xAt(divergenceForView.second);
  const divergencePriceY0 = yPrice(candles[divergenceForView.first].high);
  const divergencePriceY1 = yPrice(candles[divergenceForView.second].high);
  const divergenceMacdY0 = yMacd(series.macd[divergenceForView.first]);
  const divergenceMacdY1 = yMacd(series.macd[divergenceForView.second]);
  const labelFont = landscape ? 17 : 23;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="由一组K线计算的MACD快线、信号线与柱体" style={{width: '100%', height: '100%', display: 'block'}}>
      <defs>
        <linearGradient id={`macd-bg-${landscape ? 'wide' : 'tall'}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#102031" />
          <stop offset="100%" stopColor="#09131e" />
        </linearGradient>
        <clipPath id={`macd-clip-${landscape ? 'wide' : 'tall'}`}>
          <rect x={margin.left} y={priceTop} width={plotWidth} height={macdBottom - priceTop} />
        </clipPath>
      </defs>
      <rect x="0" y="0" width={width} height={height} rx={landscape ? 25 : 28} fill={`url(#macd-bg-${landscape ? 'wide' : 'tall'})`} stroke="#263b50" strokeWidth="2" />
      <text x={margin.left} y={landscape ? 43 : 53} fill={C.text} fontFamily={font} fontSize={labelFont} fontWeight="750">价格走势</text>
      <g fontFamily={font} fontSize={landscape ? 14 : 19} fontWeight="650">
        <line x1={margin.left + 136} y1={landscape ? 38 : 47} x2={margin.left + 158} y2={landscape ? 38 : 47} stroke={C.blue} strokeWidth="4" strokeLinecap="round" />
        <text x={margin.left + 167} y={landscape ? 44 : 53} fill={C.muted}>MACD快线</text>
        <line x1={margin.left + (landscape ? 310 : 350)} y1={landscape ? 38 : 47} x2={margin.left + (landscape ? 332 : 372)} y2={landscape ? 38 : 47} stroke={C.yellow} strokeWidth="4" strokeLinecap="round" />
        <text x={margin.left + (landscape ? 341 : 381)} y={landscape ? 44 : 53} fill={C.muted}>信号线</text>
        <rect x={margin.left + (landscape ? 455 : 520)} y={landscape ? 31 : 38} width="16" height="13" rx="2" fill={C.green} />
        <text x={margin.left + (landscape ? 478 : 543)} y={landscape ? 44 : 53} fill={C.muted}>正柱</text>
        <rect x={margin.left + (landscape ? 552 : 638)} y={landscape ? 31 : 38} width="16" height="13" rx="2" fill={C.red} />
        <text x={margin.left + (landscape ? 575 : 661)} y={landscape ? 44 : 53} fill={C.muted}>负柱</text>
      </g>
      <text x={margin.left} y={macdTop - (landscape ? 22 : 28)} fill={C.text} fontFamily={font} fontSize={labelFont} fontWeight="750">MACD</text>
      <g stroke={C.grid} strokeWidth="1.4" opacity="0.75">
        {[0, 1, 2, 3, 4].map((index) => {
          const y = priceTop + ((priceBottom - priceTop) * index) / 4;
          return <line key={`price-grid-${index}`} x1={margin.left} y1={y} x2={width - margin.right} y2={y} />;
        })}
        {[0, 1, 2, 3, 4].map((index) => {
          const y = macdTop + ((macdBottom - macdTop) * index) / 4;
          return <line key={`macd-grid-${index}`} x1={margin.left} y1={y} x2={width - margin.right} y2={y} />;
        })}
        {Array.from({length: 9}, (_, index) => {
          const x = margin.left + (plotWidth * index) / 8;
          return <line key={`vgrid-${index}`} x1={x} y1={priceTop} x2={x} y2={macdBottom} opacity="0.42" />;
        })}
      </g>
      <g clipPath={`url(#macd-clip-${landscape ? 'wide' : 'tall'})`}>
        {(mode === 'opening' || mode === 'histogram') && <rect x={openingX0 - step * 0.45} y={priceTop} width={openingX1 - openingX0 + step * 0.9} height={priceBottom - priceTop} fill={mode === 'histogram' && histogramRange === hookReexpandingBars ? C.green : C.yellow} opacity="0.075" />}
        {mode === 'close' && !landscape && summaryStage === 3 && <rect x={xAt(redExpandingBars.start)} y={priceTop} width={xAt(redExpandingBars.end) - xAt(redExpandingBars.start)} height={priceBottom - priceTop} fill={C.red} opacity="0.075" />}
        {candles.map((candle, index) => {
          const x = xAt(index);
          const rising = candle.close >= candle.open;
          const color = rising ? C.green : C.red;
          const top = yPrice(Math.max(candle.open, candle.close));
          const bodyHeight = Math.max(2.1, yPrice(Math.min(candle.open, candle.close)) - top);
          const spotlight = (mode === 'opening' || mode === 'histogram') && index >= focusRange.start && index <= focusRange.end;
          const candleOpacity = landscape ? (spotlight ? 1 : 0.5) : 1;
          return <g key={`macd-candle-${index}`}>
            <line x1={x} y1={yPrice(candle.high)} x2={x} y2={yPrice(candle.low)} stroke={color} strokeWidth={landscape ? 2 : 2} opacity={candleOpacity} />
            <rect x={x - candleWidth / 2} y={top} width={candleWidth} height={bodyHeight} rx="1" fill={rising && !landscape ? `${color}22` : color} stroke={color} strokeWidth={landscape ? 1 : 1.5} opacity={candleOpacity} />
          </g>;
        })}
        <line x1={margin.left} y1={baseline} x2={width - margin.right} y2={baseline} stroke="#d9e5f1" strokeWidth={mode === 'close' && !landscape && summaryStage === 0 ? 5 : 2} strokeDasharray={mode === 'close' && !landscape && summaryStage === 0 ? 'none' : '10 9'} opacity={mode === 'close' && !landscape && summaryStage === 0 ? 1 : 0.72} />
        {series.histogram.map((value, index) => {
          const x = xAt(index);
          const y = yMacd(value);
          const isPositive = value >= 0;
          const previousHistogram = series.histogram[index - 1];
          const shrinkingGreen = isPositive && previousHistogram !== undefined && previousHistogram > value && value > 0;
          const growingRed = !isPositive && previousHistogram !== undefined && previousHistogram < 0 && Math.abs(value) > Math.abs(previousHistogram);
          const solidHistogram = !landscape && (shrinkingGreen || growingRed);
          const inFocusRange = index >= focusRange.start && index <= focusRange.end;
          const opening = (mode === 'opening' || mode === 'histogram') && inFocusRange;
          const selected = mode === 'crosses' && Math.abs(index - activeCross.index) < 2;
          const inAnimatedWindow = (mode === 'opening' || mode === 'histogram') && inFocusRange;
          const animatedIndex = focusRange.start + histogramReveal * (focusRange.end - focusRange.start);
          const sequentiallyRevealed = !inAnimatedWindow || index <= animatedIndex;
          const revealed = (mode !== 'components' || landscape || index / candles.length <= histogramProgress) && sequentiallyRevealed;
          const summaryFocus = mode === 'close' && !landscape && summaryStage === 2 && ((index >= shrinkingBars.start && index <= shrinkingBars.end) || (index >= 42 && index <= 58));
          const summaryShrinking = index >= shrinkingBars.start && index <= shrinkingBars.end;
          const summaryRedGrowing = index >= redExpandingBars.start && index <= redExpandingBars.end;
          const summaryShown = !summaryFocus || (summaryShrinking && summaryHistogramProgress < 0.5 && index <= shrinkingBars.start + summaryHistogramProgress * 2 * (shrinkingBars.end - shrinkingBars.start)) || (summaryRedGrowing && summaryHistogramProgress >= 0.5 && index <= redExpandingBars.start + (summaryHistogramProgress - 0.5) * 2 * (redExpandingBars.end - redExpandingBars.start));
          const opacity = solidHistogram || opening || selected || summaryFocus ? 1 : mode === 'histogram' && !landscape ? 0.14 : 0.42;
          const color = isPositive ? C.green : C.red;
          return revealed && summaryShown ? <rect key={`macd-hist-${index}`} x={x - step * 0.28} y={Math.min(y, baseline)} width={Math.max(2, step * 0.56)} height={Math.max(2, Math.abs(baseline - y))} rx="1.2" fill={solidHistogram ? color : 'none'} stroke={color} strokeWidth={solidHistogram ? 0 : 1.6} opacity={opacity} /> : null;
        })}
        <path d={signalPath} pathLength="1" strokeDasharray="1" strokeDashoffset={mode === 'components' && !landscape ? 1 - signalLineProgress : 0} fill="none" stroke={C.yellow} strokeWidth={landscape ? 3.2 : 4.2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={macdPath} pathLength="1" strokeDasharray="1" strokeDashoffset={mode === 'components' && !landscape ? 1 - fastLineProgress : 0} fill="none" stroke={C.blue} strokeWidth={landscape ? 3.6 : 4.6} strokeLinecap="round" strokeLinejoin="round" />

        {(mode === 'divergence') && <g>
          <line x1={divergenceX0} y1={divergencePriceY0} x2={divergenceX1} y2={divergencePriceY1} stroke={C.red} strokeWidth="3" strokeDasharray="9 8" />
          <circle cx={divergenceX0} cy={divergencePriceY0} r="8" fill={C.panel} stroke={C.red} strokeWidth="4" />
          <circle cx={divergenceX1} cy={divergencePriceY1} r="8" fill={C.panel} stroke={C.red} strokeWidth="4" />
          <line x1={divergenceX0} y1={divergenceMacdY0} x2={divergenceX1} y2={divergenceMacdY1} stroke={C.purple} strokeWidth="3" strokeDasharray="9 8" />
          <circle cx={divergenceX0} cy={divergenceMacdY0} r="8" fill={C.panel} stroke={C.purple} strokeWidth="4" />
          <circle cx={divergenceX1} cy={divergenceMacdY1} r="8" fill={C.panel} stroke={C.purple} strokeWidth="4" />
        </g>}

        {mode === 'crosses' && <g>
          <line x1={xAt(activeCross.index)} y1={priceTop} x2={xAt(activeCross.index)} y2={macdBottom} stroke={activeCross.kind === 'golden' ? C.green : C.red} strokeWidth="2.5" strokeDasharray="8 10" opacity="0.85" />
          <circle cx={xAt(activeCross.index)} cy={yMacd(series.macd[activeCross.index])} r="9" fill={C.panel} stroke={activeCross.kind === 'golden' ? C.green : C.red} strokeWidth="4" />
        </g>}

        {mode === 'zero' && <g>
          <line x1={xAt(focusIndex)} y1={priceTop} x2={xAt(focusIndex)} y2={macdBottom} stroke={series.macd[focusIndex] >= 0 ? C.green : C.red} strokeWidth="2.5" strokeDasharray="8 10" opacity="0.8" />
          <circle cx={xAt(focusIndex)} cy={yMacd(series.macd[focusIndex])} r="9" fill={C.panel} stroke={series.macd[focusIndex] >= 0 ? C.green : C.red} strokeWidth="4" />
        </g>}

        {mode === 'close' && !landscape && summaryStage === 1 && <g>
          <circle cx={xAt(summaryCross.index)} cy={yMacd(series.macd[summaryCross.index])} r="15" fill="none" stroke={C.green} strokeWidth="4" />
          <circle cx={xAt(summaryCross.index)} cy={yMacd(series.macd[summaryCross.index])} r="6" fill={C.green} />
        </g>}

        {(mode === 'opening' || mode === 'histogram') && <g>
          <line x1={xAt(focusRange.start)} y1={yPrice(candles[focusRange.start].high) - 24} x2={xAt(focusRange.end)} y2={yPrice(candles[focusRange.end].high) - 24} stroke={mode === 'histogram' && histogramRange === hookReexpandingBars ? C.green : C.yellow} strokeWidth="3" />
          <circle cx={xAt(focusIndex)} cy={yPrice(candles[focusIndex].close)} r="8" fill={C.panel} stroke={C.green} strokeWidth="4" />
          <circle cx={xAt(focusIndex)} cy={yMacd(series.histogram[focusIndex])} r="7" fill={series.histogram[focusIndex] >= 0 ? C.green : C.red} stroke={C.text} strokeWidth="2" />
        </g>}
      </g>

      {mode === 'components' && <g fontFamily={font}>
        <rect x={width - (landscape ? 440 : 440)} y={landscape ? 118 : 128} width={landscape ? 388 : 388} height={landscape ? 170 : 202} rx="18" fill="#08121d" fillOpacity="0.94" stroke="#33495d" strokeWidth="2" />
        <text x={width - (landscape ? 410 : 410)} y={landscape ? 163 : 181} fill={C.blue} opacity={1} fontSize={landscape ? 21 : 26} fontWeight="750">快线 = EMA12 − EMA26</text>
        <text x={width - (landscape ? 410 : 410)} y={landscape ? 211 : 239} fill={C.yellow} opacity={landscape ? 1 : signalLineProgress} fontSize={landscape ? 19 : 24} fontWeight="650">信号线 = 快线的平滑线</text>
        <text x={width - (landscape ? 410 : 410)} y={landscape ? 258 : 293} fill={C.green} opacity={landscape ? 1 : histogramProgress} fontSize={landscape ? 21 : 26} fontWeight="750">柱体 = 快线 − 信号线</text>
      </g>}

      {mode === 'zero' && <g fontFamily={font}>
        <rect x={width - (landscape ? 360 : 370)} y={macdTop + 12} width={landscape ? 310 : 330} height={landscape ? 74 : 92} rx="16" fill="#08121d" fillOpacity="0.94" stroke={series.macd[focusIndex] >= 0 ? '#276d59' : '#783947'} strokeWidth="2" />
        <text x={width - (landscape ? 205 : 205)} y={macdTop + (landscape ? 58 : 72)} fill={series.macd[focusIndex] >= 0 ? C.green : C.red} textAnchor="middle" fontFamily={font} fontSize={landscape ? 22 : 27} fontWeight="750">{series.macd[focusIndex] >= 0 ? '零轴上方 · 偏多' : '零轴下方 · 偏空'}</text>
      </g>}

      {mode === 'crosses' && <g fontFamily={font}>
        <rect x={margin.left + 8} y={macdTop + 10} width={landscape ? 300 : 360} height={landscape ? 72 : 90} rx="15" fill="#08121d" fillOpacity="0.95" stroke={activeCross.kind === 'golden' ? '#276d59' : '#783947'} strokeWidth="2" />
        <text x={margin.left + (landscape ? 158 : 188)} y={macdTop + (landscape ? 56 : 71)} textAnchor="middle" fill={activeCross.kind === 'golden' ? C.green : C.red} fontFamily={font} fontSize={landscape ? 22 : 27} fontWeight="750">
          {`${activeCross.kind === 'golden' ? '金叉' : '死叉'} · 零轴${activeCross.zone === 'above' ? '上方' : '下方'}`}
        </text>
      </g>}

      {mode === 'divergence' && <g fontFamily={font}>
        <rect x={margin.left + 12} y={priceTop + 14} width={landscape ? 194 : 235} height={landscape ? 50 : 64} rx="13" fill="#08121d" fillOpacity="0.94" stroke="#783947" />
        <text x={margin.left + (landscape ? 109 : 130)} y={priceTop + (landscape ? 46 : 55)} textAnchor="middle" fill={C.red} fontSize={landscape ? 18 : 23} fontWeight="750" fontFamily={font}>价格高点抬高</text>
        <rect x={margin.left + 12} y={macdBottom - (landscape ? 48 : 62)} width={landscape ? 194 : 235} height={landscape ? 36 : 46} rx="11" fill="#08121d" fillOpacity="0.94" stroke="#594a83" />
        <text x={margin.left + (landscape ? 109 : 130)} y={macdBottom - (landscape ? 23 : 31)} textAnchor="middle" fill={C.purple} fontSize={landscape ? 17 : 21} fontWeight="750" fontFamily={font}>MACD高点降低</text>
      </g>}

      {(mode === 'opening' || mode === 'histogram') && <text x={openingX0} y={macdTop - (landscape ? 20 : 26)} fill={mode === 'histogram' && histogramRange === hookReexpandingBars ? C.green : C.yellow} fontFamily={font} fontSize={landscape ? 15 : 19} fontWeight="700">{!landscape ? (mode === 'histogram' && histogramRange === hookReexpandingBars ? '回撤后反弹 · 正柱重新放大' : '上涨后回撤 · 正柱逐步缩短') : mode === 'histogram' && histogramRange === hookReexpandingBars ? '价格续涨 · 正柱重新放大' : '价格上行 · 正柱逐步缩短'}</text>}
      {mode === 'close' && !landscape && <g fontFamily={font} fontSize="17" fontWeight="750" textAnchor="middle">
        {['零轴定背景', '交叉看位置', '柱体看变化', '回到价格确认'].map((label, index) => {
          const chipWidth = plotWidth / 4 - 7;
          const x = margin.left + index * (plotWidth / 4) + 3;
          const y = priceBottom + 31;
          const active = index === summaryStage;
          return <g key={`summary-step-${index}`}>
            <rect x={x} y={y} width={chipWidth} height="48" rx="15" fill={active ? '#183449' : '#0a1520'} stroke={active ? [C.yellow, C.green, C.red, C.blue][index] : '#263b50'} strokeWidth={active ? 3 : 1.5} />
            <text x={x + chipWidth / 2} y={y + 31} fill={active ? [C.yellow, C.green, C.red, C.blue][index] : C.muted}>{label}</text>
          </g>;
        })}
      </g>}
      <text x={margin.left} y={height - (landscape ? 22 : 29)} fill={C.faint} fontFamily={font} fontSize={landscape ? 14 : 18}>由同一组K线计算 · EMA12 / EMA26 / 信号线9</text>
    </svg>
  );
};

const Background: React.FC<{children: ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: 'radial-gradient(ellipse at 50% 34%, #142638 0%, #07111c 62%)', color: C.text, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 0, opacity: 0.15, backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`, backgroundSize: '82px 82px', maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 82%, transparent)'}} />
    {children}
  </AbsoluteFill>
);

const MacdScene: React.FC<{config: SceneConfig}> = ({config}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const landscape = width > 1500;
  const duration = !landscape ? (portraitDurations[config.id] ?? voiceDurations[config.id]) : voiceDurations[config.id];
  const durationFrames = duration * fps;
  const progress = Math.min(1, frame / Math.max(1, durationFrames));
  const currentMs = (frame / fps) * 1000;
  const portraitCaptions: Partial<Record<SceneId, Caption[]>> = {
    '01-opening': portraitOpeningCaptions as Caption[],
    '02-components': portraitComponentsCaptions as Caption[],
    '05-histogram': portraitHistogramCaptions as Caption[],
  };
  const captions = !landscape ? (portraitCaptions[config.id] ?? config.captions) : config.captions;
  const activeCaption = captions.find((caption) => currentMs >= caption.startMs && currentMs < caption.endMs);
  const histogramReexpanding = !landscape && config.mode === 'histogram' && progress >= 0.48;
  const portraitOpening = !landscape && config.mode === 'opening';
  const portraitHistogram = !landscape && config.mode === 'histogram';
  const captionOpacity = activeCaption
    ? interpolate(frame, [activeCaption.startMs * fps / 1000, activeCaption.startMs * fps / 1000 + 4], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const pagePadding = landscape ? '48px 64px 108px' : '72px 52px 214px';
  const titleSize = landscape ? 52 : 66;
  const captionStyle: CSSProperties = {
    position: 'absolute', zIndex: 4, left: landscape ? 72 : 42, right: landscape ? 72 : 42,
    bottom: landscape ? 26 : 42, minHeight: landscape ? 58 : 136, boxSizing: 'border-box',
    padding: landscape ? '10px 22px' : '22px 26px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: landscape ? 15 : 22, border: `1px solid ${C.grid}`,
    background: landscape ? 'rgba(5, 13, 23, 0.72)' : 'rgba(5, 13, 23, 0.94)',
    color: C.text, fontFamily: font, fontSize: landscape ? 23 : 31, fontWeight: 650, lineHeight: 1.34,
    textAlign: 'center', opacity: captionOpacity,
  };

  return (
    <Background>
      <Audio src={staticFile(!landscape && portraitDurations[config.id] ? `episodes/macd/voiceover-portrait/${config.id}.wav` : `episodes/macd/voiceover/${config.id}.wav`)} premountFor={fps} />
      <div style={{position: 'relative', zIndex: 1, height: '100%', boxSizing: 'border-box', padding: pagePadding, display: 'flex', flexDirection: 'column'}}>
        {landscape ? <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 28, minHeight: 118, marginBottom: 14}}>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12, color: C.green, fontSize: 17, fontWeight: 800, letterSpacing: 1.2, marginBottom: 7}}><span style={{width: 27, height: 3, backgroundColor: C.green}} />{config.kicker}</div>
            <div style={{fontSize: titleSize, lineHeight: 1.12, fontWeight: 800, letterSpacing: 0.1}}>{config.title}</div>
          </div>
          <div style={{color: C.muted, textAlign: 'right', fontSize: 22, fontWeight: 500, maxWidth: 570, lineHeight: 1.4}}>{config.subtitle}</div>
        </div> : <div style={{marginBottom: 12}}>
          <div style={{display: 'inline-flex', alignItems: 'center', border: `1px solid ${C.green}66`, color: C.green, background: `${C.green}12`, borderRadius: 999, padding: '10px 20px', fontSize: 22, fontWeight: 750, letterSpacing: 0.8, marginBottom: 22}}>{config.kicker}</div>
          <div style={{fontSize: titleSize, lineHeight: 1.18, fontWeight: 850, letterSpacing: 0.15}}>{histogramReexpanding ? <>回撤后强势反弹，<span style={{color: C.green}}>正柱重新放大</span></> : portraitOpening ? <>价格还在创新高，<br /><span style={{color: C.green}}>绿柱却在缩短</span></> : portraitHistogram ? <>回撤时，<span style={{color: C.yellow}}>正柱逐步收窄</span></> : config.title}</div>
          <div style={{marginTop: 10, color: C.muted, fontSize: 29, lineHeight: 1.38, fontWeight: 500}}>{histogramReexpanding ? '价格重新走强，柱体也跟着扩张。' : portraitOpening ? '上涨动能还在变强吗？' : portraitHistogram ? '接着看价格能不能强势反弹。' : config.subtitle}</div>
        </div>}
        <div style={{flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <MacdChart mode={config.mode} progress={progress} landscape={landscape} />
        </div>
      </div>
      <div style={captionStyle}>{activeCaption?.text ?? ''}</div>
    </Background>
  );
};

const Timeline: React.FC = () => {
  const {fps} = useVideoConfig();
  const {width} = useVideoConfig();
  const landscape = width > 1500;
  return <Series>
    {scenes.map((scene) => {
      const duration = !landscape ? (portraitDurations[scene.id] ?? voiceDurations[scene.id]) : voiceDurations[scene.id];
      return <Series.Sequence key={scene.id} name={scene.kicker} durationInFrames={Math.ceil(duration * fps) + Math.round(0.28 * fps)} premountFor={fps}><MacdScene config={scene} /></Series.Sequence>;
    })}
  </Series>;
};

const portraitTotalSeconds = Object.entries(voiceDurations).reduce((sum, [id, duration]) => sum + (portraitDurations[id] ?? duration), 0) + 7 * 0.28;
export const MACDComposition = () => <Composition id="MACDExplainer" component={Timeline} durationInFrames={Math.ceil(portraitTotalSeconds * 30)} fps={30} width={1080} height={1920} />;

export const MACDLandscapeComposition = () => <Composition id="MACDExplainerLandscape" component={Timeline} durationInFrames={Math.ceil(totalSeconds * 30)} fps={30} width={1920} height={1080} />;
