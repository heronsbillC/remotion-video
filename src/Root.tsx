import { MyComposition, MyLandscapeComposition } from "./Composition";
import { EMAComposition, EMALandscapeComposition } from "./EMAComposition";
import { MACDComposition, MACDLandscapeComposition } from "./MACDComposition";
import { MACDRedesignComposition } from "./MACDRedesign";
import { RegimeComposition } from "./RegimeComposition";
import { RegimeCoverComposition } from "./RegimeCover";
import { KeltnerComposition } from "./KeltnerComposition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <MyLandscapeComposition />
      <EMAComposition />
      <EMALandscapeComposition />
      <MACDComposition />
      <MACDLandscapeComposition />
      <MACDRedesignComposition />
      <RegimeComposition />
      <RegimeCoverComposition />
      <KeltnerComposition />
    </>
  );
};
