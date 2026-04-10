import AppBackground from "./components/layout/AppBackground.jsx";
import IntroSequence from "./components/layout/IntroSequence.jsx";
import FrameContainer from "./components/layout/FrameContainer.jsx";
import Header from "./components/layout/Header.jsx";
import Footer from "./components/layout/Footer.jsx";

export default function App() {
  return (
    <>
      <AppBackground />
      <IntroSequence>
        <FrameContainer>
          <Header />
          <main className="space-y-10">
            {/* HeroRegion placeholder — real content in Part F */}
            <section className="hero flex aspect-[16/9] w-full items-center justify-center border border-rule bg-bg/60 md:aspect-[16/9]">
              <p className="font-serif italic text-ink-dim text-lg">
                Interactive sky chart · arrives next session
              </p>
            </section>

            {/* ControlsStrip placeholder — real content in Part E */}
            <section className="controls-strip border border-rule bg-bg/60 p-6 text-ink-dim">
              <p className="font-mono text-xs uppercase tracking-widest">
                Controls strip placeholder
              </p>
            </section>

            {/* InfoPanelsGrid placeholder — real content in Part F */}
            <section className="space-y-6">
              <div className="panel border border-rule bg-bg/60 p-6 text-ink-dim">
                <p className="font-mono text-xs uppercase tracking-widest">
                  Info panels placeholder
                </p>
              </div>
            </section>
          </main>
          <Footer />
        </FrameContainer>
      </IntroSequence>
    </>
  );
}
