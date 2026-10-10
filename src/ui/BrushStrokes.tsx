import React, { useId } from "react";
import "./BrushStrokes.scss";

/*
 * Blue and orange paint-brush streaks, the brand mark of the social posts (ported from
 * the-clash-frontend/src/components/BrushStrokes). Only on the photo tops of Log in and Tournaments.
 * Pure decoration: hidden from assistive tech, never focusable, never takes the pointer.
 * The streaks rise to the right like the slash in the logo.
 *
 * `variant`:
 *   corner  bold blue and orange streaks for the corner of a photo (the parent's class places, sizes and turns it)
 *   edge    a thin full-width strip of streaks along an edge (the parent sets top or bottom, and the height)
 */

type Colour = "blue" | "orange";

// --- corner: flat bars roughened by one displacement filter, as in the approved mockups ---

const CORNER = {
  viewBox: "0 0 260 300",
  filter: { x: "-10%", y: "-40%", width: "120%", height: "180%", frequency: "0.035 0.6", seed: 7, scale: 14 },
  transform: "rotate(-62 60 120)",
  bars: [
    { colour: "blue", x: -40, y: 40, width: 300, height: 16 },
    { colour: "orange", x: -30, y: 70, width: 240, height: 9 },
    { colour: "blue", x: 10, y: 92, width: 280, height: 22, opacity: 0.9 },
    { colour: "orange", x: -60, y: 126, width: 200, height: 7 },
    { colour: "orange", x: 40, y: 146, width: 230, height: 12, opacity: 0.95 },
  ] as { colour: Colour; x: number; y: number; width: number; height: number; opacity?: number }[],
};

const CornerBrush: React.FC<{ filterId: string; className?: string }> = ({ filterId, className }) => {
  const { filter } = CORNER;
  return (
    <svg
      className={["brush-variant", "brush-variant--corner", className].filter(Boolean).join(" ")}
      viewBox={CORNER.viewBox}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id={filterId} x={filter.x} y={filter.y} width={filter.width} height={filter.height}>
          <feTurbulence type="fractalNoise" baseFrequency={filter.frequency} numOctaves="3" seed={filter.seed} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={filter.scale} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} transform={CORNER.transform}>
        {CORNER.bars.map(({ colour, opacity, ...rect }, i) => (
          <rect key={i} className={`brush-variant__${colour}`} {...rect} opacity={opacity} />
        ))}
      </g>
    </svg>
  );
};

// --- edge: dry-brush streaks drawn as bristle bands, stretched along an edge ---

// A streak starts at (x, y), runs `length` units at `angle` degrees (counter-clockwise from pointing right) and is
// `width` units thick. Starts beyond the box edge hide the streak's head, so only its frayed tail shows.
type Streak = { x: number; y: number; length: number; width: number; colour: Colour; seed: number; angle: number };

// For a 1000 x 40 strip, stretched to the edge's width: two blue streaks from either end meeting in the middle,
// with thinner orange ones beside them.
const EDGE = {
  width: 1000,
  height: 40,
  texture: { rough: "0.008 0.22", roughScale: 3.5, grain: "0.004 0.28", slope: 9, cut: 6.1 },
  streaks: [
    { x: -20, y: 21, length: 660, width: 12, colour: "blue", seed: 17, angle: 0.6 },
    { x: 1020, y: 16, length: 580, width: 10, colour: "blue", seed: 31, angle: 180.6 },
    { x: 150, y: 33, length: 560, width: 5, colour: "orange", seed: 53, angle: 0.5 },
    { x: 1010, y: 6, length: 320, width: 3.5, colour: "orange", seed: 59, angle: 180.4 },
  ] as Streak[],
};

// Small deterministic random numbers, so the drawing is the same on every render.
const random = (seed: number) => {
  let state = seed * 9301 + 49297;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
};

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * One streak as a bundle of bristle bands laid along +x from 0 to `length`, centred on y = 0.
 * Each band starts and ends a little differently, the outer bands end sooner (a tapering tip),
 * and a few thin hairs and paint specks trail past the tip: the dry-brush look.
 */
const streakShapes = ({ length, width, seed }: Streak) => {
  const rand = random(seed);
  const bands = Math.max(3, Math.round(width));
  const step = width / bands;
  const polygons: string[] = [];
  for (let i = 0; i < bands; i++) {
    const top = -width / 2 + i * step + (rand() < 0.28 ? step * 0.35 : 0);
    const bottom = -width / 2 + (i + 1) * step;
    const middle = (top + bottom) / 2;
    const edge = Math.abs(i + 0.5 - bands / 2) / (bands / 2); // 0 in the middle of the streak, 1 at its sides
    const start = rand() * length * 0.06;
    const end = length * (1 - 0.06 - edge * edge * 0.32 - rand() * 0.16);
    const point = Math.min(length * 0.08, (bottom - top) * 6);
    polygons.push(
      [
        [start, middle],
        [start + point * 0.4, top],
        [end - point, top],
        [end, middle + (rand() - 0.5) * (bottom - top)],
        [end - point * 1.4, bottom],
        [start + point * 0.4, bottom],
      ]
        .map(([x, y]) => `${round(x)},${round(y)}`)
        .join(" ")
    );
  }
  const hairs = Array.from({ length: Math.max(2, Math.round(width / 3)) }, () => {
    const y = (rand() - 0.5) * width * 0.8;
    const from = length * (0.55 + rand() * 0.2);
    const to = length * (0.92 + rand() * 0.14);
    const h = Math.max(0.35, step * (0.25 + rand() * 0.3));
    return { x: round(from), y: round(y - h / 2), width: round(to - from), height: round(h) };
  });
  const specks = Array.from({ length: 3 + Math.round(width / 3) }, () => ({
    cx: round(length * (0.8 + rand() * 0.3)),
    cy: round((rand() - 0.5) * width * 1.6),
    r: round(0.25 + rand() * 0.55),
  }));
  return { polygons, hairs, specks };
};

const EDGE_STREAKS = EDGE.streaks.map((streak) => ({ streak, shapes: streakShapes(streak) }));
const EDGE_REGION = (() => {
  const longest = Math.max(...EDGE.streaks.map((s) => s.length));
  const widest = Math.max(...EDGE.streaks.map((s) => s.width));
  // The filter works in each streak's own space: room for the specks past the tip and the roughened edges.
  return { x: -12, y: -(widest + 6), width: longest * 1.15 + 24, height: (widest + 6) * 2 };
})();

const EdgeBrush: React.FC<{ filterId: string; className?: string }> = ({ filterId, className }) => {
  const { texture } = EDGE;
  return (
    <svg
      className={["brush-strokes", "brush-strokes--band", className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${EDGE.width} ${EDGE.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* In each streak's own (rotated) space: stretched noise roughens the edges, then long thin grain
            along the streak opens dry-brush gaps */}
        <filter id={filterId} filterUnits="userSpaceOnUse" {...EDGE_REGION}>
          <feTurbulence type="fractalNoise" baseFrequency={texture.rough} numOctaves="2" seed="4" result="noise" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={texture.roughScale}
            xChannelSelector="R"
            yChannelSelector="G"
            result="rough"
          />
          <feTurbulence type="fractalNoise" baseFrequency={texture.grain} numOctaves="2" seed="9" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values={`0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -${texture.slope} ${texture.cut}`}
            result="holes"
          />
          <feComposite in="rough" in2="holes" operator="in" />
        </filter>
      </defs>
      {EDGE_STREAKS.map(({ streak, shapes }) => (
        <g
          key={streak.seed}
          className={`brush-strokes__streak brush-strokes__streak--${streak.colour}`}
          transform={`translate(${streak.x} ${streak.y}) rotate(${-streak.angle})`}
        >
          <g filter={`url(#${filterId})`}>
            {shapes.polygons.map((points, i) => (
              <polygon key={i} points={points} />
            ))}
            {shapes.hairs.map((hair, i) => (
              <rect key={i} {...hair} opacity={0.8} />
            ))}
            {shapes.specks.map((speck, i) => (
              <circle key={i} {...speck} />
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
};

interface BrushStrokesProps {
  variant?: "corner" | "edge";
  className?: string;
}

export function BrushStrokes({ variant = "corner", className }: BrushStrokesProps): React.JSX.Element {
  const filterId = `brush-${useId().replace(/[^\w-]/g, "")}`;
  return variant === "edge" ? (
    <EdgeBrush filterId={filterId} className={className} />
  ) : (
    <CornerBrush filterId={filterId} className={className} />
  );
}

export default BrushStrokes;
