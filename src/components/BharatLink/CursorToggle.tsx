"use client";

import { useEffect, useState } from "react";

export function CursorToggle({ className = "" }: { className?: string }) {
  const [enabled, setEnabled] = useState(true);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Only show toggle on fine pointer devices (desktop with hover)
    const pointerQuery = window.matchMedia("(pointer: fine) and (hover: hover)");
    setIsSupported(pointerQuery.matches);

    const saved = localStorage.getItem("bharatlink_custom_cursor");
    if (saved === "false") {
      setEnabled(false);
    }
  }, []);

  if (!isSupported) return null;

  const toggleCursor = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem("bharatlink_custom_cursor", String(next));
    window.location.reload(); // Refresh to apply state cleanly
  };

  return (
    <button
      type="button"
      onClick={toggleCursor}
      title="Toggle custom glowing cursor"
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
        enabled
          ? "bg-orange-500/10 text-orange-600 border border-orange-500/30 hover:bg-orange-500/20"
          : "bg-slate-200 text-slate-600 border border-slate-300 hover:bg-slate-300"
      } ${className}`}
    >
      <span className={`h-2 w-2 rounded-full ${enabled ? "bg-orange-500 animate-pulse" : "bg-slate-400"}`} />
      <span>{enabled ? "Glowing Cursor ON" : "System Cursor"}</span>
    </button>
  );
}
