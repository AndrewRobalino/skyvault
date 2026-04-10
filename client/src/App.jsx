import AppBackground from "./components/layout/AppBackground.jsx";
import IntroSequence from "./components/layout/IntroSequence.jsx";
import FrameContainer from "./components/layout/FrameContainer.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import HeroRegion from "./components/hero/HeroRegion.jsx";
import ControlsStrip from "./components/controls/ControlsStrip.jsx";
import InfoPanelsGrid from "./components/info/InfoPanelsGrid.jsx";

export default function App() {
  return (
    <>
      <AppBackground />
      <IntroSequence>
        <FrameContainer>
          <Header />
          <main className="space-y-10">
            <HeroRegion />
            <ControlsStrip />
            <InfoPanelsGrid />
          </main>
          <Footer />
        </FrameContainer>
      </IntroSequence>
    </>
  );
}
