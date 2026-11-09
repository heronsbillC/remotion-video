import {
  AbsoluteFill,
  Composition,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { Audio } from "@remotion/media";
import {ATRFormulaVisual, ChartAverages, ChartData, ChartIndicators, GeneratedCandlestickChart, TrendRangeComparison} from "./GeneratedCharts";

const C = {
  bg: "#07111c",
  panel: "#101e2c",
  panel2: "#142536",
  grid: "#23384b",
  text: "#f4f7fb",
  muted: "#9cb0c4",
  green: "#42dfa0",
  red: "#ff647c",
  yellow: "#ffd166",
  blue: "#5db5ff",
};

const Text = ({
  children,
  size = 56,
  color = C.text,
  weight = 700,
  style = {},
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}) => (
  <div
    style={{
      color,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
      fontSize: size,
      fontWeight: weight,
      lineHeight: 1.28,
      letterSpacing: 0.2,
      ...style,
    }}
  >
    {children}
  </div>
);

const Pill = ({ children, color = C.green }: { children: React.ReactNode; color?: string }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      border: `1px solid ${color}66`,
      color,
      background: `${color}12`,
      borderRadius: 999,
      padding: "12px 22px",
      fontSize: 25,
      fontWeight: 700,
      letterSpacing: 1,
    }}
  >
    {children}
  </div>
);

const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {width} = useVideoConfig();
  const landscape = width > 1400;
  return <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 35%, #142638 0%, ${C.bg} 58%)`,
      color: C.text,
      padding: landscape ? "38px 56px 84px" : "110px 76px 125px",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: 0.16,
        backgroundImage: `linear-gradient(${C.grid} 1px, transparent 1px), linear-gradient(90deg, ${C.grid} 1px, transparent 1px)`,
        backgroundSize: "84px 84px",
        maskImage: "linear-gradient(to bottom, transparent, black 22%, black 80%, transparent)",
      }}
    />
    {children}
    {!landscape && <div style={{ position: "absolute", bottom: 56, left: 76, right: 76, display: "flex", justifyContent: "space-between", color: "#72879b", fontSize: 20, letterSpacing: 1 }}>
      <span>INDICATOR FIELD NOTES</span><span>SUPERTREND · 01</span>
    </div>}
  </AbsoluteFill>;
};

const Scene: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  visual?: React.ReactNode;
  emphasis?: string;
  titleSize?: number;
  voiceFile: string;
  voiceDuration: number;
  captions: string[];
}> = ({ eyebrow, title, subtitle, visual, emphasis, titleSize = 60, voiceFile, voiceDuration, captions }) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const landscape = width > 1400;
  const speechFrames = voiceDuration * fps;
  const weights = captions.map((caption) => caption.length + ((caption.match(/[，。；：？！]/g) ?? []).length * 2));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  const captionWindows = weights.map((weight) => {
    const start = cursor;
    cursor += (speechFrames * weight) / weightSum;
    return [start, cursor] as const;
  });
  const activeCaptionIndex = captionWindows.findIndex(([start, end]) => frame >= start && frame < end);
  const captionOpacity = activeCaptionIndex < 0 ? 0 : interpolate(
    frame,
    [captionWindows[activeCaptionIndex][0], captionWindows[activeCaptionIndex][0] + 5],
    [0, 1],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );
  return (
    <Backdrop>
      <Audio src={staticFile(`voiceover-xiaoxiao/${voiceFile}.wav`)} premountFor={fps} />
      {landscape ? <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 8, width: "100%", height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 28, minHeight: 104, padding: "0 16px" }}>
          <div style={{ minWidth: 0 }}>
            <Text size={16} color={C.green} weight={700} style={{ letterSpacing: 1.2, marginBottom: 7 }}>{eyebrow}</Text>
            <Text size={Math.max(39, Math.round(titleSize * 0.72))} style={{ lineHeight: 1.12 }}>{title}</Text>
          </div>
          {subtitle && <Text size={21} color={C.muted} weight={500} style={{ maxWidth: 560, textAlign: "right", paddingBottom: 5 }}>{subtitle}</Text>}
        </div>
        {visual && <div style={{ flex: 1, minHeight: 0, width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>{visual}</div>}
        {emphasis && <div style={{ position: "absolute", zIndex: 2, right: 22, top: 118, color: C.yellow, fontSize: 19, fontWeight: 700, textShadow: "0 2px 10px #07111c" }}>{emphasis}</div>}
      </div> : <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
        <Pill>{eyebrow}</Pill>
        <Text size={titleSize} style={{ maxWidth: 900 }}>{title}</Text>
        {subtitle && <Text size={30} color={C.muted} weight={500} style={{ maxWidth: 900 }}>{subtitle}</Text>}
        {visual && <div style={{ marginTop: 4 }}>{visual}</div>}
        {emphasis && <Text size={28} color={C.yellow} weight={700} style={{ marginTop: 4 }}>{emphasis}</Text>}
      </div>}
      <div style={{
        position: "absolute", zIndex: 2, left: landscape ? 72 : 54, right: landscape ? 72 : 54, bottom: landscape ? 28 : 126,
        minHeight: landscape ? 42 : 112, boxSizing: "border-box", padding: landscape ? "6px 16px" : "22px 28px",
        display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: landscape ? 0 : 22, border: `1px solid ${C.grid}`,
        background: landscape ? "rgba(5, 13, 23, 0.54)" : "rgba(5, 13, 23, 0.94)", color: C.text,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif",
        fontSize: landscape ? 22 : 30, fontWeight: 600, lineHeight: 1.3, textAlign: "center",
        opacity: captionOpacity,
      }}>
        {captions[activeCaptionIndex] ?? ""}
      </div>
    </Backdrop>
  );
};

const Opening = () => <Scene eyebrow="一个回撤难题" title={<>涨势里的深回调，<br />要不要走？</>} subtitle="一段上涨之后，价格突然大幅回落。" visual={<GeneratedCandlestickChart data={ChartData.pullback} indicator={ChartIndicators.pullback} frame={useCurrentFrame()} height={570} revealSeconds={0} playheadSeconds={5.2} />} emphasis="只看K线涨跌，很难知道趋势是否真的变了。" titleSize={64} voiceFile="01-opening" voiceDuration={10.56} captions={["股票涨着涨着，突然回撤。", "你会被一根大阴线吓下车，还是继续拿？", "关键是：怎么判断趋势真的变了？"]} />;

const Role = () => <Scene eyebrow="给走势加上趋势边界" title={<>回撤很深，<br /><span style={{ color: C.green }}>趋势线仍守住了</span></>} subtitle="价格先上涨，再回落；Supertrend线随行情逐步跟上。" visual={<GeneratedCandlestickChart data={ChartData.pullback} indicator={ChartIndicators.pullback} frame={useCurrentFrame()} height={570} showSupertrend revealSeconds={0} indicatorRevealSeconds={5.8} annotatePullback />} emphasis="收盘仍在线上，随后价格继续走高。" voiceFile="02-role" voiceDuration={8.76} captions={["Supertrend给你一条会随波动移动的趋势线：", "涨时通常在价格下方，跌时通常在上方。"]} />;

const ATRScene = () => {
  const frame = useCurrentFrame();
  return (
    <Scene
      eyebrow="Supertrend 的波动尺"
      title={<>ATR 衡量的，是<br /><span style={{ color: C.yellow }}>价格通常晃多大</span></>}
      subtitle="固定刻度看波幅，不拿股价高低当波动。"
      visual={<ATRFormulaVisual frame={frame} />}
      voiceFile="03-atr"
      voiceDuration={13.44}
      captions={["它的宽窄来自ATR——近期价格通常晃多大。", "波动放大，边界留宽些；波动收敛，边界靠近。", "ATR量波动，不分涨跌方向。"]}
    />
  );
};

const FlipScene = () => {
  const frame = useCurrentFrame();
  return <Scene eyebrow="线为什么会换边？" title={<>只有收盘越线，<br /><span style={{ color: C.red }}>指标才翻到另一侧</span></>} subtitle="注意看最后这段：K线逐步走弱，收盘跌破后红线才出现。" visual={<GeneratedCandlestickChart data={ChartData.reversal} indicator={ChartIndicators.reversal} frame={frame} height={600} showSupertrend revealSeconds={13} indicatorRevealSeconds={13} />} emphasis="盘中刺穿不算，等这一根收盘。" voiceFile="04-flip" voiceDuration={16.056} captions={["上涨时，线在价格下方；只要收盘没跌破它，趋势状态就延续。", "收盘跌破，Supertrend翻到上方。", "下跌时反过来：收盘突破上方边界，线就翻到下方。"]} />;
};

const ExampleScene = () => {
  const frame = useCurrentFrame();
  const labels = frame < 210 ? "趋势延续" : frame < 350 ? "回撤仍在线上" : frame < 390 ? "价格续涨" : "收盘越线，趋势翻转";
  return <Scene eyebrow="从守线到破线" title={<>回撤时别猜，<br />看它有没有守住线</>} subtitle="先守住趋势线、随后继续上涨；后来的收盘破线，指标才翻边。" visual={<GeneratedCandlestickChart data={ChartData.story} indicator={ChartIndicators.story} frame={frame} height={580} showSupertrend revealSeconds={13} annotatePullback />} emphasis={labels} voiceFile="05-example" voiceDuration={13.584} captions={["回撤时别被每根阴线牵着走，先看收盘在哪边。", "还在趋势线的一侧，就继续观察；", "收盘越线、指标换边，趋势状态才确认切换。"]} />;
};

const TradeoffScene = () => <Scene eyebrow="它的取舍" title={<>趋势里跟随，<br /><span style={{ color: C.yellow }}>震荡里反复</span></>} subtitle="同一指标放进两种行情，线的表现不同。" visual={<TrendRangeComparison frame={useCurrentFrame()} />} voiceFile="06-tradeoff" voiceDuration={15.792} captions={["代价是慢一步：等收盘确认时，拐点已经走过一段。", "好处是你有条边界跟踪趋势，不用每根K线都重新猜。", "可横盘时，价格来回穿线，信号也会反复。"]} />;

const CloseScene = () => <Scene eyebrow="你会用哪条线跟趋势？" title={<>均线更平滑，<br /><span style={{ color: C.green }}>Supertrend更像边界</span></>} subtitle="同一段K线，同时画出20周期均线和Supertrend。" visual={<div style={{display: "grid", gap: 10}}><div style={{display: "flex", justifyContent: "center", gap: 24, color: C.muted, fontSize: 20, fontWeight: 700}}><span><i style={{display: "inline-block", width: 24, borderTop: `4px dashed ${C.blue}`, marginRight: 8, verticalAlign: "middle"}} />均线</span><span><i style={{display: "inline-block", width: 24, borderTop: `4px solid ${C.green}`, marginRight: 8, verticalAlign: "middle"}} />Supertrend</span></div><GeneratedCandlestickChart data={ChartData.story} indicator={ChartIndicators.story} movingAverage={ChartAverages.story} frame={useCurrentFrame()} height={540} showSupertrend revealSeconds={6.5} /></div>} emphasis="你跟趋势更愿意看均线，还是Supertrend？" titleSize={58} voiceFile="07-close" voiceDuration={8.352} captions={["回撤来了，先看收盘和这条线的关系。", "你跟趋势更愿意看Supertrend，还是看均线？"]} />;

export const MyVideo = () => {
  const { fps } = useVideoConfig();
  return (
    <Series>
      <Series.Sequence name="回撤钩子" durationInFrames={Math.ceil(10.56 * fps) + fps * 0.3} premountFor={fps}><Opening /></Series.Sequence>
      <Series.Sequence name="趋势边界" durationInFrames={Math.ceil(8.76 * fps) + fps * 0.3} premountFor={fps}><Role /></Series.Sequence>
      <Series.Sequence name="ATR与波动" durationInFrames={Math.ceil(13.44 * fps) + fps * 0.3} premountFor={fps}><ATRScene /></Series.Sequence>
      <Series.Sequence name="收盘越线翻转" durationInFrames={Math.ceil(16.056 * fps) + fps * 0.3} premountFor={fps}><FlipScene /></Series.Sequence>
      <Series.Sequence name="图表跟踪示例" durationInFrames={Math.ceil(13.584 * fps) + fps * 0.3} premountFor={fps}><ExampleScene /></Series.Sequence>
      <Series.Sequence name="优势与局限" durationInFrames={Math.ceil(15.792 * fps) + fps * 0.3} premountFor={fps}><TradeoffScene /></Series.Sequence>
      <Series.Sequence name="结尾互动" durationInFrames={Math.ceil(8.352 * fps) + fps * 0.3} premountFor={fps}><CloseScene /></Series.Sequence>
    </Series>
  );
};

export const MyComposition = () => (
  <Composition
    id="SupertrendExplainer"
    component={MyVideo}
    durationInFrames={2662}
    fps={30}
    width={1080}
    height={1920}
  />
);

export const MyLandscapeComposition = () => (
  <Composition
    id="SupertrendExplainerLandscape"
    component={MyVideo}
    durationInFrames={2662}
    fps={30}
    width={1920}
    height={1080}
  />
);
