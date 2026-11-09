import React from "react";
import {AbsoluteFill, Composition, Img, staticFile} from "remotion";

const font = "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif";
type CoverProps = {withNames: boolean};

const Cover: React.FC<CoverProps> = ({withNames}) => <AbsoluteFill style={{background: "#06111f", fontFamily: font, color: "#fff", overflow: "hidden"}}>
  <Img src={staticFile("assets/regime-cover-market-bg.png")} style={{position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"}} />
  <div style={{position: "absolute", inset: 0, background: "linear-gradient(180deg, #03122275 0%, #06101bdd 34%, #06101b95 65%, #06101b05 100%)"}} />
  <div style={{position: "absolute", top: 94, left: 0, right: 0, textAlign: "center", fontSize: 30, fontWeight: 900, color: "#85dfff", letterSpacing: 2}}>行情先分环境，再看信号</div>
  <div style={{position: "absolute", left: 54, right: 54, top: 286, textAlign: "center", padding: "42px 28px 48px", borderRadius: 34, background: "linear-gradient(145deg, #071624d9, #07121bc2)", border: "1px solid #54d9ff66", boxShadow: "0 24px 60px #000b"}}>
    <div style={{fontSize: 118, lineHeight: .99, fontWeight: 950, letterSpacing: -7, textShadow: "0 4px 0 #000, 0 0 22px #0c2845"}}>别再把<span style={{color: "#ffca52"}}>震荡</span><br />当成<span style={{color: "#ff5d67"}}>趋势</span>！</div>
    <div style={{marginTop: 44, display: "inline-flex", borderRadius: 16, padding: "17px 30px", background: "#edfaff", color: "#07131e", fontSize: 34, fontWeight: 950, boxShadow: "0 8px 0 #28bde5"}}>{withNames ? "CHOP + KER 帮你看清行情" : "一个错误，让策略反复打脸"}</div>
  </div>
  <div style={{position: "absolute", bottom: 85, left: 0, right: 0, textAlign: "center", fontSize: 30, fontWeight: 900, color: "#d9f7ff", textShadow: "0 2px 6px #000"}}>判断趋势 / 震荡，再决定怎么用指标</div>
</AbsoluteFill>;

export const RegimeCoverComposition = () => <><Composition id="RegimeCoverNamed" component={Cover} defaultProps={{withNames: true}} durationInFrames={1} fps={30} width={1080} height={1440} /><Composition id="RegimeCoverPain" component={Cover} defaultProps={{withNames: false}} durationInFrames={1} fps={30} width={1080} height={1440} /></>;
