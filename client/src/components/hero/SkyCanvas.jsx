import { useEffect, useRef } from "react";
import { drawStar, drawPlanet } from "../../utils/drawing.js";

export default function SkyCanvas({ projectedStars, projectedPlanets, width, height, dpr }) {
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
  }, [projectedStars, projectedPlanets, width, height, dpr]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0"
      aria-hidden="true"
    />
  );
}
