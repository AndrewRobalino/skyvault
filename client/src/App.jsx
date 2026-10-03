import { useEffect } from "react";
import { api } from "./api/client.js";
import AppBackground from "./components/layout/AppBackground.jsx";
import IntroSequence from "./components/layout/IntroSequence.jsx";
import FrameContainer from "./components/layout/FrameContainer.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";
import AboutPage from "./components/about/AboutPage.jsx";
import HeroRegion from "./components/hero/HeroRegion.jsx";
import ControlsStrip from "./components/controls/ControlsStrip.jsx";
import InfoPanelsGrid from "./components/info/InfoPanelsGrid.jsx";

// /about without a router dependency: one extra page, chosen by path.
// Cloudflare Pages serves index.html for it via public/_redirects.
const isAboutPath = () => window.location.pathname.replace(/\/+$/, "") === "/about";

export default function App() {
  useEffect(() => {
    api.health();
  }, []);

  if (isAboutPath()) {
    return (
      <>
        <AppBackground />
        <FrameContainer>
          <AboutPage />
          <Footer />
        </FrameContainer>
      </>
    );
  }

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
