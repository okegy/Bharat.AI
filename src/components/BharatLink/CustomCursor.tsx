"use client";

import { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);

  const [enabled, setEnabled] = useState(true);
  const [cursorState, setCursorState] = useState<"default" | "hover" | "mic" | "text">("default");
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isTouch, setIsTouch] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Position physics state
  const mousePos = useRef({ x: -100, y: -100 });
  const cursorPos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const magneticTarget = useRef<{ x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    // Check user preference toggle from localStorage
    const saved = localStorage.getItem("bharatlink_custom_cursor");
    if (saved === "false") {
      setEnabled(false);
    }

    // Check prefers-reduced-motion
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      setReducedMotion(true);
    }
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    motionQuery.addEventListener("change", handleMotionChange);

    // Check pointer fine / touch
    const pointerQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    if (!pointerQuery.matches) {
      setIsTouch(true);
    }

    return () => {
      motionQuery.removeEventListener("change", handleMotionChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || isTouch || reducedMotion) {
      document.documentElement.classList.remove("custom-cursor-active");
      return;
    }

    document.documentElement.classList.add("custom-cursor-active");

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      // Inspect target element for state morphing
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const micBtn = target.closest('[data-cursor="mic"], button[aria-label*="mic" i], button[aria-label*="voice" i], .mic-button');
      const clickable = target.closest('button, a, [role="button"], input[type="submit"], input[type="button"], select, .clickable');
      const textInput = target.closest('input[type="text"], input[type="search"], textarea, [contenteditable="true"]');

      if (micBtn) {
        setCursorState("mic");
        const rect = micBtn.getBoundingClientRect();
        magneticTarget.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      } else if (textInput) {
        setCursorState("text");
        magneticTarget.current = null;
      } else if (clickable) {
        setCursorState("hover");
        const rect = clickable.getBoundingClientRect();
        // Mild magnetic pull toward center if within range
        const dist = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
        if (dist < 60) {
          magneticTarget.current = {
            x: e.clientX + (rect.left + rect.width / 2 - e.clientX) * 0.35,
            y: e.clientY + (rect.top + rect.height / 2 - e.clientY) * 0.35,
          };
        } else {
          magneticTarget.current = null;
        }
      } else {
        setCursorState("default");
        magneticTarget.current = null;
      }
    };

    const onMouseDown = () => {
      setIsMouseDown(true);
      if (rippleRef.current) {
        rippleRef.current.classList.remove("animate-cursor-ripple");
        // Force reflow
        void rippleRef.current.offsetWidth;
        rippleRef.current.classList.add("animate-cursor-ripple");
      }
    };

    const onMouseUp = () => {
      setIsMouseDown(false);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);

    // Smooth animation loop using lerp (linear interpolation)
    const render = () => {
      const targetX = magneticTarget.current ? magneticTarget.current.x : mousePos.current.x;
      const targetY = magneticTarget.current ? magneticTarget.current.y : mousePos.current.y;

      // Instant follow for inner dot
      cursorPos.current.x += (targetX - cursorPos.current.x) * 0.45;
      cursorPos.current.y += (targetY - cursorPos.current.y) * 0.45;

      // Smooth lag / comet tail easing for outer ring
      ringPos.current.x += (targetX - ringPos.current.x) * 0.18;
      ringPos.current.y += (targetY - ringPos.current.y) * 0.18;

      if (cursorRef.current) {
        cursorRef.current.style.transform = `translate3d(${cursorPos.current.x}px, ${cursorPos.current.y}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }

      rafId.current = requestAnimationFrame(render);
    };

    rafId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, [enabled, isTouch, reducedMotion]);

  if (!enabled || isTouch || reducedMotion) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      {/* Outer Easing Ring / Comet Trail */}
      <div
        ref={ringRef}
        className={`pointer-events-none absolute -left-4 -top-4 rounded-full transition-all duration-200 ease-out ${
          cursorState === "mic"
            ? "h-12 w-12 border-2 border-orange-500/90 bg-orange-500/20 shadow-[0_0_24px_rgba(234,88,12,0.6)] animate-pulse"
            : cursorState === "hover"
            ? "h-10 w-10 border-2 border-orange-500/70 bg-orange-500/10 backdrop-blur-[2px] shadow-[0_0_16px_rgba(234,88,12,0.4)]"
            : cursorState === "text"
            ? "h-7 w-2 border border-orange-500/80 bg-orange-500/30 rounded-sm"
            : "h-8 w-8 border border-orange-500/40 bg-orange-500/5 shadow-[0_0_10px_rgba(234,88,12,0.2)]"
        } ${isMouseDown ? "scale-75 opacity-90" : "scale-100 opacity-100"}`}
      />

      {/* Inner Glowing Coral Orb / Caret */}
      <div
        ref={cursorRef}
        className={`pointer-events-none absolute -left-2 -top-2 rounded-full transition-all duration-150 ease-out ${
          cursorState === "mic"
            ? "h-4 w-4 bg-orange-500 shadow-[0_0_16px_#ea580c] ring-2 ring-orange-300 animate-ping"
            : cursorState === "hover"
            ? "h-3 w-3 bg-orange-500 shadow-[0_0_12px_#ea580c]"
            : cursorState === "text"
            ? "h-5 w-0.5 bg-orange-600 shadow-[0_0_6px_#ea580c] rounded-full"
            : "h-3.5 w-3.5 bg-orange-500/90 shadow-[0_0_10px_rgba(234,88,12,0.8)]"
        } ${isMouseDown ? "scale-125" : "scale-100"}`}
      >
        {/* Ripple Click Effect */}
        <div
          ref={rippleRef}
          className="pointer-events-none absolute -inset-4 rounded-full border border-orange-500/80 bg-orange-500/30 opacity-0"
        />
      </div>
    </div>
  );
}
