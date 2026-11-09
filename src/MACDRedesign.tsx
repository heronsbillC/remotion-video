import React from 'react';
import {AbsoluteFill, Composition, interpolate, Series, staticFile, useCurrentFrame} from 'remotion';
import {Audio} from '@remotion/media';
import voice from './macd-redesign-voice.json';
import {makeTeachingSeries, type TeachingSeries} from './macd-teaching-data';

// Silent storyboard preview: spoken copy is shown as captions until the
// approved voice can be regenerated. All plotted values come from the candles.
const bullPath = [100,103,101,107,104,111,108,116,112,108,106,109,107,112,109,115,112,119,117,123];
const bearPath = [135,131,133,127,130,123,125,118,121,115,111,114,117,115,112,109,112,105,102,104,98,96];
// Continuous-market chart: each candle opens at the previous close; keep the
// same closes, so every calculated MACD value remains valid.
const continuous = (data: TeachingSeries): TeachingSeries => ({...data, candles:data.candles.map((c,i)=>{const open=i?data.candles[i-1].close:c.open;return {...c,open,high:Math.max(c.high,open),low:Math.min(c.low,open)};})});
const hookSeries = continuous(makeTeachingSeries([90,96,93,101,98,108,104,112,109,116,113,120,117,123,120,126,124,128],36,82));
const hookEnd = 55;
if (!(hookSeries.candles[55].close>hookSeries.candles[53].close && hookSeries.histogram[53]>hookSeries.histogram[54] && hookSeries.histogram[54]>hookSeries.histogram[55] && hookSeries.histogram[55]>0)) throw new Error('Opening must show rising prices and shrinking positive bars');
const aboveGolden = continuous(makeTeachingSeries(bullPath, 97, 70));
const aboveDeath = continuous(makeTeachingSeries([96,101,98,105,101,109,106,113,109,115,111,107,105,107,104,110,107,114,111,117,114,120], 51, 70));
const belowGolden = continuous(makeTeachingSeries(bearPath, 97, 70));
const belowDeath = continuous(makeTeachingSeries([140,137,139,132,135,129,131,125,122,124,128,126,122,119,122,115,111,113,107,104,106,100], 51, 70));
const divergenceSeries = continuous(makeTeachingSeries([95,99,102,108,114,120,116,112,109,110,111,112,113,114,115,116,117,118,119,120,121,122,118,114], 1, 64));
const divergenceFirst = 15;
const divergenceSecond = 54;
if (!(divergenceSeries.candles[divergenceSecond].high > divergenceSeries.candles[divergenceFirst].high && divergenceSeries.macd[divergenceSecond] < divergenceSeries.macd[divergenceFirst])) throw new Error('Divergence example must match its chart annotations');
type Event = {index: number; kind: 'golden' | 'death'; zone: 'above' | 'below'};
const eventAt = (series: TeachingSeries, kind: Event['kind'], zone: Event['zone'], after: number): Event => {
  const event = series.crosses.find((e) => e.kind === kind && e.zone === zone && e.index >= after);
  if (!event) throw new Error(`Missing ${zone} ${kind} example`);
  return event;
};
const examples = {
  ag: {series: aboveGolden, event: eventAt(aboveGolden, 'golden', 'above', 35)},
  ad: {series: aboveDeath, event: eventAt(aboveDeath, 'death', 'above', 20)},
  bg: {series: belowGolden, event: eventAt(belowGolden, 'golden', 'below', 20)},
  bd: {series: belowDeath, event: eventAt(belowDeath, 'death', 'below', 40)},
};
const palette = {bg:'#07111c', panel:'#101e2c', grid:'#284052', text:'#f1f6fa', muted:'#a4b5c5', green:'#37d6a2', red:'#ff637a', blue:'#5db5ff', gold:'#ffd166'};
const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif";
const fps = 30;
const scenes = [
  {seconds:7, title:'价格还在涨，\n柱子为什么变短？', copy:[], kind:'hook'},
  {seconds:15, title:'MACD 看什么？', copy:['快线是短期 EMA 减去长期 EMA，显示两条均线之间的距离。','信号线是快线的平滑线；快线与信号线相互靠近、交叉，显示动能正在变化。','柱体是快线减去信号线：两线距离越大，柱体越长。'], kind:'components'},
  {seconds:15, title:'先看零轴：\n分清多空背景', copy:['快线是短期 EMA 减去长期 EMA。快线在零轴上方，短期均线高于长期均线，是偏多背景。','快线在零轴下方，短期均线低于长期均线，是偏空背景。'], kind:'zero'},
  {seconds:22, title:'同样的金叉，\n位置决定背景', copy:['零轴上方金叉，发生在多头背景中：上涨回踩后，快线上穿信号线，动能可能重新恢复。','零轴下方金叉，仍在空头背景中：价格可能只是下跌中反弹，要留意反弹能否改变低点不断下移的结构。'], kind:'golden'},
  {seconds:22, title:'死叉也要看\n零轴的位置', copy:['零轴上方死叉，可能是上涨途中的回调；观察回调是否守住前面的低点。','零轴下方死叉，发生在偏空背景中，反弹后快线下穿，可能伴随下跌动能再次增强。'], kind:'death'},
  {seconds:16, title:'柱体提前告诉你：\n动能正在变化', copy:['柱体是快线减去信号线。绿柱缩短，说明两线的距离在收窄，上涨动能可能正在减弱。','如果两线继续靠近并形成死叉，柱体就会穿过零轴；柱体变化不是单独的卖出指令。'], kind:'histogram'},
  {seconds:15, title:'价格新高，\nMACD 没跟上', copy:['价格第二个高点更高，MACD 快线的高点却更低，这就是顶背离。','它提示上涨动能没有同步增强；接下来观察价格是否跌破前面的回调低点。'], kind:'divergence'},
  {seconds:8, title:'看 MACD 的顺序', copy:['先看零轴判断背景，再看交叉发生的位置，结合柱体变化，最后回到价格结构。'], kind:'close'},
] as const;
const durationFrames = (kind: keyof typeof voice) => Math.ceil((voice[kind].durationMs + 200) * fps / 1000);
const totalFrames = scenes.reduce((sum, s) => sum + durationFrames(s.kind), 0);

const Chart: React.FC<{data: TeachingSeries; event?: Event; label: string; accent: string; compact?: boolean; reveal: number; highlightHistogram?: boolean; divergence?: boolean; introProgress?: number; endAt?:number; hookHighlight?:boolean; showEma?:boolean; emaProgress?:number; barFocus?:[number,number]; crossProgress?:number; zeroFocus?:'above'|'below'; focusOpacity?:number}> = ({data,event,label,accent,compact=false,reveal,highlightHistogram=false,divergence=false,introProgress,endAt,hookHighlight,showEma,emaProgress=1,barFocus,crossProgress,zeroFocus,focusOpacity=1}) => {
  const {candles,macd,signal,histogram}=data;
  const w=880, h=compact?520:890, left=35, right=28, top=84, priceBottom=compact?265:510, macdTop=compact?300:585, bottom=compact?480:825;
  const start=event?Math.max(6,event.index-27):6, end=endAt ?? (event?Math.min(candles.length-1,event.index+17):candles.length-1), n=end-start+1, step=(w-left-right)/(n-1);
  const xs=(i:number)=>left+(i-start)*step;
  const price=candles.slice(start,end+1), lo=Math.min(...price.map(c=>c.low)), hi=Math.max(...price.map(c=>c.high));
  const yp=(v:number)=>top+(hi-v)/(hi-lo)*(priceBottom-top);
  const max=Math.max(...macd.slice(start,end+1).map(Math.abs),...signal.slice(start,end+1).map(Math.abs),...histogram.slice(start,end+1).map(Math.abs))*1.18;
  const ym=(v:number)=>macdTop+(max-v)/(2*max)*(bottom-macdTop), zero=ym(0);
  const path=(arr:number[])=>arr.slice(start,end+1).map((v,i)=>`${i?'L':'M'} ${xs(i+start).toFixed(1)} ${ym(v).toFixed(1)}`).join(' ');
  const crossCursor=event && crossProgress!==undefined ? Math.min(end,event.index-5+crossProgress*8) : undefined;
  const partialPath=(arr:number[])=>{if(crossCursor===undefined)return path(arr);const last=Math.floor(crossCursor);const part=arr.slice(start,last+1).map((v,i)=>`${i?'L':'M'} ${xs(i+start).toFixed(1)} ${ym(v).toFixed(1)}`).join(' ');const t=crossCursor-last;return part+` L ${xs(crossCursor).toFixed(1)} ${ym(arr[last]+(arr[Math.min(last+1,end)]-arr[last])*t).toFixed(1)}`};
  const crossFraction=event?Math.abs(macd[event.index-1]-signal[event.index-1])/(Math.abs(macd[event.index-1]-signal[event.index-1])+Math.abs(macd[event.index]-signal[event.index])):0;
  const crossX=event?event.index-1+crossFraction:0;
  const crossY=event?macd[event.index-1]+(macd[event.index]-macd[event.index-1])*crossFraction:0;
  const visible = start + Math.round((end-start)*reveal);
  const fastReveal=introProgress===undefined?reveal:Math.min(1,introProgress*3);
  const signalReveal=introProgress===undefined?reveal:Math.max(0,Math.min(1,(introProgress-1/3)*3));
  const barsReveal=introProgress===undefined?1:Math.max(0,Math.min(1,(introProgress-2/3)*3));
  const labelSize=compact?28:31;
  const emaValues = (period:number) => {let value=candles[0].close;return candles.map(c=>{value+=(c.close-value)*2/(period+1);return value})};
  const shortEma=emaValues(12), longEma=emaValues(26);
  const emaIndex=start+Math.round((end-start)*emaProgress);
  const focusIndex=zeroFocus ? Array.from({length:end-start+1},(_,i)=>end-i).find(i=>zeroFocus==='above'?macd[i]>0:macd[i]<0) : undefined;
  return <svg viewBox={`0 0 ${w} ${h}`} style={{width:'100%',display:'block'}}>
    <rect width={w} height={h} rx="25" fill={palette.panel} stroke="#2a4053" strokeWidth="2"/>
    <text x="34" y="49" fill={accent} fontFamily={font} fontWeight="750" fontSize={labelSize}>{label}</text>
    <text x="845" y="49" textAnchor="end" fill={palette.muted} fontFamily={font} fontSize="19">蓝：快线 / 黄：信号线</text>
    {[0,1,2,3].map(i=><line key={i} x1={left} x2={w-right} y1={top+(priceBottom-top)*i/3} y2={top+(priceBottom-top)*i/3} stroke={palette.grid} opacity=".6"/>)}
    {price.map((c,j)=>{const i=j+start, x=xs(i), up=c.close>=c.open, col=up?palette.green:palette.red, y=yp(Math.max(c.open,c.close)), bh=Math.max(3,yp(Math.min(c.open,c.close))-y);return <g key={i} opacity={i<=visible?1:.13}><line x1={x} x2={x} y1={yp(c.high)} y2={yp(c.low)} stroke={col} strokeWidth="2"/><rect x={x-step*.31} y={y} width={step*.62} height={bh} rx="1" fill={col}/></g>})}
    {showEma && [shortEma,longEma].map((values,k)=><path key={k} d={values.slice(start,end+1).map((v,i)=>`${i?'L':'M'} ${xs(i+start).toFixed(1)} ${yp(v).toFixed(1)}`).join(' ')} fill="none" stroke={k?palette.gold:palette.blue} strokeWidth="4" pathLength="1" strokeDasharray="1" strokeDashoffset={1-emaProgress}/>)}
    {showEma && emaProgress>.08 && <g><line x1={xs(emaIndex)} x2={xs(emaIndex)} y1={yp(shortEma[emaIndex])} y2={yp(longEma[emaIndex])} stroke={palette.gold} strokeWidth="5"/><circle cx={xs(emaIndex)} cy={yp(shortEma[emaIndex])} r="7" fill={palette.blue}/><circle cx={xs(emaIndex)} cy={yp(longEma[emaIndex])} r="7" fill={palette.gold}/></g>}
    <line x1={left} x2={w-right} y1={zero} y2={zero} stroke="#d4e1ec" strokeWidth="2" strokeDasharray="7 7"/><text x="5" y={zero+6} fill={palette.muted} fontSize="20">0</text>
    {highlightHistogram && event && visible>=event.index-1 && <rect x={xs(event.index-4)-step*.65} y={ym(histogram[event.index-4])-12} width={xs(event.index-1)-xs(event.index-4)+step*1.3} height={zero-ym(histogram[event.index-4])+24} rx="12" fill={palette.gold} fillOpacity=".07" stroke={palette.gold} strokeWidth="2" strokeDasharray="6 6"/>}
    {histogram.slice(start,end+1).map((v,j)=>{const i=j+start, prev=histogram[i-1], positive=v>=0, solid=positive?v<prev:v<prev, c=positive?palette.green:palette.red, y=ym(v);return <rect key={i} x={xs(i)-step*.3} y={Math.min(y,zero)} width={step*.6} height={Math.max(1.5,Math.abs(y-zero))} fill={solid?c:'none'} stroke={c} strokeWidth="1.4" opacity={crossCursor!==undefined&&i>crossCursor?0:barsReveal*(i<=visible?(highlightHistogram?1:.65):.08)}/>})}
    {hookHighlight && visible>=hookEnd && <rect x={xs(hookEnd-2)-step*.55} y={ym(histogram[hookEnd-2])-12} width={step*3.1} height={zero-ym(histogram[hookEnd-2])+24} rx="10" fill="none" stroke={palette.gold} strokeWidth="3" strokeDasharray="7 6"/>}
    {barFocus && <rect x={xs(barFocus[0])-step*.55} y={Math.min(zero,...histogram.slice(barFocus[0],barFocus[1]+1).map(ym))-12} width={step*(barFocus[1]-barFocus[0]+1.1)} height={Math.max(zero,...histogram.slice(barFocus[0],barFocus[1]+1).map(ym))-Math.min(zero,...histogram.slice(barFocus[0],barFocus[1]+1).map(ym))+24} rx="10" fill="none" stroke={palette.gold} strokeWidth="3" strokeDasharray="7 6"/>}
    <path d={partialPath(macd)} fill="none" stroke={palette.blue} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={crossCursor===undefined?1-fastReveal:0}/>
    <path d={partialPath(signal)} fill="none" stroke={palette.gold} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" pathLength="1" strokeDasharray="1" strokeDashoffset={crossCursor===undefined?1-signalReveal:0}/>
    {focusIndex!==undefined && <g opacity={focusOpacity}><line x1={left} x2={w-right} y1={zero} y2={zero} stroke={accent} strokeWidth="4"/><line x1={xs(focusIndex)} x2={xs(focusIndex)} y1={zero} y2={ym(macd[focusIndex])} stroke={accent} strokeWidth="3" strokeDasharray="5 4"/><circle cx={xs(focusIndex)} cy={ym(macd[focusIndex])} r="9" fill={palette.blue} stroke={palette.text} strokeWidth="2"/><text x={Math.min(w-150,xs(focusIndex)-145)} y={zeroFocus==='above'?ym(macd[focusIndex])-12:ym(macd[focusIndex])+28} fill={accent} fontFamily={font} fontSize="23" fontWeight="700">{zeroFocus==='above'?'快线 > 0':'快线 < 0'}</text></g>}
    {event && (crossCursor===undefined?visible>=event.index:crossCursor>=crossX) && <g><circle cx={xs(crossX)} cy={ym(crossY)} r="18" fill="none" stroke={accent} strokeWidth="4"/><circle cx={xs(crossX)} cy={ym(crossY)} r="5" fill={accent}/>{crossCursor!==undefined && <text x={Math.min(w-100,xs(crossX)+24)} y={ym(crossY)-22} fill={accent} fontFamily={font} fontSize="27" fontWeight="700">{event.kind==='golden'?'金叉':'死叉'}</text>}</g>}
    {divergence && reveal>.72 && <g stroke={palette.red} fill="none" strokeWidth="4" strokeDasharray="9 7"><line x1={xs(divergenceFirst)} y1={yp(candles[divergenceFirst].high)} x2={xs(divergenceSecond)} y2={yp(candles[divergenceSecond].high)}/><line x1={xs(divergenceFirst)} y1={ym(macd[divergenceFirst])} x2={xs(divergenceSecond)} y2={ym(macd[divergenceSecond])}/><circle cx={xs(divergenceFirst)} cy={yp(candles[divergenceFirst].high)} r="10"/><circle cx={xs(divergenceSecond)} cy={yp(candles[divergenceSecond].high)} r="10"/><circle cx={xs(divergenceFirst)} cy={ym(macd[divergenceFirst])} r="10"/><circle cx={xs(divergenceSecond)} cy={ym(macd[divergenceSecond])} r="10"/></g>}
  </svg>;
};

const Scene: React.FC<{scene: typeof scenes[number]}> = ({scene}) => {
  const frame=useCurrentFrame();
  const timing=voice[scene.kind], ms=frame*1000/fps;
  const current=timing.captions.find((caption,i)=>ms>=caption.startMs && ms<(timing.captions[i+1]?.startMs ?? timing.durationMs));
  const stage=current?.stage ?? (ms < timing.captions[0].startMs ? 0 : timing.captions[timing.captions.length-1].stage);
  const progress=Math.min(1,frame/durationFrames(scene.kind));
  const stageStart=timing.captions.find(c=>c.stage===stage)?.startMs ?? 0;
  const stageEnd=timing.captions.find(c=>c.stage>stage)?.startMs ?? timing.durationMs;
  const stageProgress=Math.max(0,Math.min(1,(ms-stageStart)/Math.max(1,stageEnd-stageStart)));
  const introProgress=scene.kind==='components' ? Math.min(1,Math.max(0,(stage-1+Math.min(1,stageProgress*3))/3)) : undefined;
  const reveal=interpolate(progress,[0,.45],[.2,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const pair=scene.kind==='death'?[examples.ad,examples.bd]:[examples.ag,examples.bg];
  const pairLabels=scene.kind==='death'?['零轴上方死叉 · 回调','零轴下方死叉 · 弱势延续']:['零轴上方金叉 · 回踩后恢复','零轴下方金叉 · 下跌中反弹'];
  const single=scene.kind==='histogram'?examples.ad:examples.ag;
  const definingCross=scene.kind==='golden'&&stage<2;
  const definitionExample=stage===0?examples.ag:examples.ad;
  return <AbsoluteFill style={{background:'radial-gradient(ellipse at 50% 30%,#142638,#07111c 72%)',color:palette.text,fontFamily:font,padding:'68px 65px 110px',boxSizing:'border-box'}}>
    <Audio src={`${staticFile(`episodes/macd/redesign-voice/${scene.kind}.mp3`)}?v=20261026-zero`}/>
    <div style={{fontSize:24,color:palette.green,fontWeight:750,letterSpacing:2}}>MACD 指标讲解</div>
    <div style={{fontSize:62,fontWeight:850,lineHeight:1.18,whiteSpace:'pre-line',marginTop:24}}>{definingCross?'什么是金叉和死叉？':scene.title}</div>
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:20,marginTop:25,marginBottom:20}}>
      {scene.kind==='hook' && <Chart data={hookSeries} endAt={hookEnd} label="价格上涨 · 柱体缩短" accent={palette.gold} reveal={reveal} hookHighlight/>}
      {definingCross && <Chart data={definitionExample.series} event={definitionExample.event} label={stage===0?'快线上穿信号线':'快线下穿信号线'} accent={stage===0?palette.green:palette.red} reveal={1} crossProgress={Math.min(1,stageProgress*1.2)}/>}
      {((scene.kind==='golden'&&!definingCross)||scene.kind==='death'||scene.kind==='zero') && pair.map((item,i)=><div key={i} style={{opacity:(scene.kind==='golden'?stage-2:stage)===i?1:.48}}><Chart data={item.series} event={scene.kind==='zero'?undefined:item.event} label={scene.kind==='zero'?(i===0?'快线在零轴上方 · 偏多':'快线在零轴下方 · 偏空'):pairLabels[i]} accent={i===0?palette.green:palette.red} compact reveal={scene.kind==='zero'?1:reveal} zeroFocus={scene.kind==='zero'&&stage===i?(i===0?'above':'below'):undefined} focusOpacity={Math.min(1,stageProgress*6)}/></div>)}
      {(scene.kind==='components'||scene.kind==='histogram'||scene.kind==='divergence') && <Chart data={scene.kind==='divergence'?divergenceSeries:scene.kind==='histogram'&&stage===2?examples.bg.series:single.series} event={scene.kind==='histogram'&&stage!==1?(stage===2?examples.bg.event:single.event):undefined} label={scene.kind==='components'?'均线距离 · 动能变化':scene.kind==='histogram'?(stage===2?'负柱缩短 · 下跌动能减弱':stage===1?'正柱放大 · 上涨动能增强':'正柱缩短 · 上涨动能减弱'):'价格高点抬高 · MACD 高点降低'} accent={palette.gold} reveal={scene.kind==='components'||(scene.kind==='histogram'&&stage===1)?1:reveal} introProgress={introProgress} showEma={scene.kind==='components'&&stage<2} emaProgress={scene.kind==='components'&&stage===0?Math.min(1,stageProgress*1.5):1} barFocus={scene.kind==='histogram'&&stage===1?[55,57]:undefined} highlightHistogram={scene.kind==='histogram'&&stage===0} divergence={scene.kind==='divergence'}/>}
      {scene.kind==='close' && <div style={{display:'grid',gap:24}}>{['① 零轴：偏多还是偏空','② 交叉：发生在零轴哪一侧','③ 柱体：动能变强还是变弱','④ 价格：结构是否确认'].map((text,i)=><div key={text} style={{background:palette.panel,border:`2px solid ${progress>i/5?palette.blue:'#2a4053'}`,borderRadius:22,padding:'34px 30px',fontSize:37,fontWeight:700}}>{text}</div>)}</div>}
    </div>
    <div style={{minHeight:110,borderRadius:22,background:'#07121eef',border:'1px solid #2b4152',padding:'20px 28px',fontSize:39,lineHeight:1.35,fontWeight:650,textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>{current?.text ?? ''}</div>
  </AbsoluteFill>;
};

const Storyboard: React.FC = () => {
  return <Series>{scenes.map(scene=><Series.Sequence key={scene.kind} name={scene.title.replace('\n',' ')} durationInFrames={durationFrames(scene.kind)} premountFor={fps}><Scene scene={scene}/></Series.Sequence>)}</Series>;
};

export const MACDRedesignComposition = () => <Composition id="MACDRedesignPortrait" component={Storyboard} durationInFrames={totalFrames} fps={fps} width={1080} height={1920}/>;
