import { useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { quarkHsl } from "@/lib/colors";

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = {
  kind: "pebble" | "circle";
  size: number;
  angle: number;
  radius: number;
  rotate: number;
  duration: number;
  delay: number;
  alpha: number;
  corner: number; // pebble corner radius as a fraction of its size
};

/**
 * The completion burst: shapes in the habit's color radiating from the
 * circle. Deterministic per seed so the same habit/day always bursts the
 * same way. Renders absolutely over its parent; self-unmounts via onDone.
 */
export function BurstCelebration({
  colorKey,
  seed,
  variant = "normal",
  spread,
  onDone,
}: {
  colorKey: string;
  seed: number;
  variant?: "normal" | "milestone";
  /** How far particles fly (px). Defaults per variant. */
  spread?: number;
  onDone: () => void;
}) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const particles = useMemo<Particle[]>(() => {
    const rnd = mulberry32(seed);
    const count = variant === "milestone" ? 30 : 14;
    const maxR = spread ?? (variant === "milestone" ? 150 : 96);
    return Array.from({ length: count }, (_, i) => ({
      // Mostly soft pebbles (rounded squares) like the real Atoms hero, a few
      // round ones for variety — no sharp confetti.
      kind: rnd() < 0.72 ? "pebble" : "circle",
      size: 9 + rnd() * 8,
      angle: (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.6,
      radius: 46 + rnd() * (maxR - 46),
      rotate: (rnd() - 0.5) * 160,
      duration: 0.6 + rnd() * 0.3,
      delay: rnd() * 0.06,
      alpha: [1, 0.8, 0.55][i % 3],
      corner: 0.32 + rnd() * 0.12,
    }));
  }, [seed, variant, spread]);

  const lifespan = variant === "milestone" ? 1500 : 1000;

  useEffect(() => {
    const t = window.setTimeout(onDone, reduced ? 400 : lifespan);
    return () => window.clearTimeout(t);
  }, [onDone, lifespan, reduced]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {/* expanding pebble ring */}
      <motion.span
        className="absolute inset-0 rounded-[42%] border-2"
        style={{ borderColor: quarkHsl(colorKey, 0.8) }}
        initial={{ scale: 0.6, opacity: 0.85 }}
        animate={{ scale: reduced ? 1.1 : 1.5, opacity: 0 }}
        transition={{ duration: reduced ? 0.3 : 0.62, ease: "circOut" }}
      />
      {!reduced &&
        particles.map((p, i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: p.size,
              height: p.size,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
              backgroundColor: quarkHsl(colorKey, p.alpha),
              borderRadius: p.kind === "circle" ? "50%" : `${Math.round(p.corner * 100)}%`,
            }}
            initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: 0 }}
            animate={{
              x: Math.cos(p.angle) * p.radius,
              y: Math.sin(p.angle) * p.radius,
              // spring out (overshoot) then settle + fade while flying outward
              scale: [0.4, 1.1, 0.92, 0.6],
              opacity: [0, 1, 1, 0],
              rotate: p.rotate,
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              ease: "easeOut",
              times: [0, 0.3, 0.6, 1],
            }}
          />
        ))}
    </div>
  );
}
