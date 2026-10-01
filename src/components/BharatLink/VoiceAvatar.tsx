"use client";

import { useEffect, useState } from "react";

export type VoiceAvatarState = "idle" | "listening" | "thinking" | "speaking";

/**
 * VoiceAvatar — the assistant's animated presence.
 * Layered glassmorphic orb (per ui-ux-pro-max glassmorphism guidance:
 * backdrop blur, translucent layers, light-source glow, reduced-motion safe).
 *
 * idle      → breathing coral glow
 * listening → expanding sonar rings
 * thinking  → orbiting satellite dots
 * speaking  → rotating conic ring + live waveform bars
 */
export function VoiceAvatar({
  state,
  size = 96,
  children,
}: {
  state: VoiceAvatarState;
  size?: number;
  /** The interactive control rendered inside the orb (e.g. the mic button). */
  children?: React.ReactNode;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(q.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);

  const anim = (name: string) => (reducedMotion ? undefined : name);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Sonar rings — listening */}
      {state === "listening" && (
        <>
          <span
            className="voice-avatar-sonar pointer-events-none absolute inset-0 rounded-full border-2 border-orange-500/60"
            style={{ animation: anim("voiceSonar 1.6s ease-out infinite") }}
          />
          <span
            className="voice-avatar-sonar pointer-events-none absolute inset-0 rounded-full border-2 border-orange-400/40"
            style={{ animation: anim("voiceSonar 1.6s ease-out 0.5s infinite") }}
          />
          <span
            className="voice-avatar-sonar pointer-events-none absolute inset-0 rounded-full border border-amber-400/30"
            style={{ animation: anim("voiceSonar 1.6s ease-out 1s infinite") }}
          />
        </>
      )}

      {/* Rotating conic halo — speaking (fast) / thinking (slow) */}
      {(state === "speaking" || state === "thinking") && (
        <span
          className="voice-avatar-ring pointer-events-none absolute inset-[-6px] rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(234,88,12,0.95), rgba(249,115,22,0.35), rgba(251,191,36,0.7), rgba(234,88,12,0.95))",
            WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3.5px), #000 calc(100% - 3px))",
            animation: anim(`voiceSpin ${state === "speaking" ? "1.4s" : "3.2s"} linear infinite`),
            filter: "drop-shadow(0 0 8px rgba(234,88,12,0.45))",
          }}
        />
      )}

      {/* Soft breathing glow — idle */}
      {(state === "idle" || state === "listening") && (
        <span
          className="voice-avatar-core pointer-events-none absolute inset-[-4px] rounded-full bg-gradient-to-br from-orange-500/25 via-amber-400/15 to-transparent"
          style={{ animation: anim("voiceBreathe 3.2s ease-in-out infinite") }}
        />
      )}

      {/* Glass orb face */}
      <div
        className="voice-avatar-face relative flex items-center justify-center overflow-hidden rounded-full border border-white/25"
        style={{
          width: size - 16,
          height: size - 16,
          background:
            "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0.08) 55%), linear-gradient(135deg, #ea580c, #f97316 55%, #f59e0b)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow:
            state === "listening"
              ? "0 0 26px rgba(234,88,12,0.55), inset 0 1px 1px rgba(255,255,255,0.5)"
              : "0 0 16px rgba(234,88,12,0.3), inset 0 1px 1px rgba(255,255,255,0.45)",
        }}
      >
        {/* Waveform bars — speaking / listening */}
        {(state === "speaking" || state === "listening") && !reducedMotion && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 top-0 flex items-center justify-center gap-[3px] opacity-90">
            {[0.9, 0.6, 1.1, 0.7, 1.0].map((delay, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white/85"
                style={{
                  height: `${28 + i * 6}%`,
                  animation: `voiceBar ${0.7 + (i % 3) * 0.18}s ease-in-out ${delay}s infinite`,
                }}
              />
            ))}
          </span>
        )}

        {/* Orbiting dots — thinking */}
        {state === "thinking" && !reducedMotion && (
          <span className="pointer-events-none absolute inset-0">
            {[0, 120, 240].map((deg) => (
              <span
                key={deg}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                style={{
                  transform: `rotate(${deg}deg) translateY(-${size * 0.28}px)`,
                }}
              />
            ))}
          </span>
        )}

        {/* Interactive control (mic button etc.) sits above the face */}
        <span className="relative z-10 flex items-center justify-center">{children}</span>
      </div>
    </div>
  );
}
