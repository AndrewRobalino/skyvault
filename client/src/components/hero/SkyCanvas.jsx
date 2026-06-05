import { useEffect, useRef } from "react";
import { drawStar, drawPlanet } from "../../utils/drawing.js";
import { drawDso } from "../../utils/dsoDrawing.js";

export default function SkyCanvas({ projectedStars, projectedPlanets, projectedDsos, projectedLines, width, height, dpr }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (width === 0 || height === 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // Layer order: constellation lines first (behind DSOs/stars/planets).
    const lines = projectedLines ?? [];
    if (lines.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(160, 190, 230, 0.44)";
      ctx.lineWidth = dpr > 1 ? 1.5 : 1;
      for (const ln of lines) {
        ctx.beginPath();
        ctx.moveTo(ln.x1, ln.y1);
        ctx.lineTo(ln.x2, ln.y2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Layer order: DSOs under stars (cluster stars pop through), planets on top.
    for (const d of projectedDsos ?? []) {
      if (d.x < -200 || d.x > width + 200) continue;
      if (d.y < -200 || d.y > height + 200) continue;
      drawDso(ctx, d);
    }

    for (const s of projectedStars) {
      if (s.x < -32 || s.x > width + 32) continue;
      if (s.y < -32 || s.y > height + 32) continue;
      drawStar(ctx, s);
    }

    for (const p of projectedPlanets) {
      if (p.x < -32 || p.x > width + 32) continue;
      if (p.y < -32 || p.y > height + 32) continue;
      drawPlanet(ctx, p);
    }
  }, [projectedStars, projectedPlanets, projectedDsos, projectedLines, width, height, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}
