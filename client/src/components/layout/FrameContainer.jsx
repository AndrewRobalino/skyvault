/**
 * Outer framed container. Max-width 1280px centered, thin accent-dim border,
 * gold corner brackets via CSS ::before / ::after pseudo-elements on the
 * `.frame` class (defined in global.css).
 */
export default function FrameContainer({ children }) {
  return (
    <div className="frame relative mx-auto w-full max-w-[1280px] border border-accent-dim/40 bg-bg-frame px-6 py-10 md:px-10 md:py-14">
      {children}
    </div>
  );
}
