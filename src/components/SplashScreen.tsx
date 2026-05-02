"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "attendix_splash_shown";
const DISPLAY_MS = 7000;
const FADE_MS = 700;

// Persists through Strict Mode double-invoke — initialized once, never reset
const splashControl = {
  initialized: false,
  shouldShow: false,
};

function WaveDots({ corner }: { corner: "tr" | "bl" }) {
  const cols = 9;
  const rows = 9;
  const gap = 22;
  const dots: React.ReactNode[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dc = corner === "tr" ? cols - 1 - c : c;
      const dr = corner === "tr" ? r : rows - 1 - r;
      const dist = Math.sqrt(dc * dc + dr * dr);
      const maxDist = Math.sqrt((cols - 1) ** 2 + (rows - 1) ** 2);
      const norm = dist / maxDist;
      if (norm > 0.82) continue;

      // Fully deterministic — no Math.random() to avoid hydration mismatch
      const delay = ((r * 0.09 + c * 0.07) % 1.5).toFixed(2);
      const size = norm < 0.3 ? 3.5 : norm < 0.6 ? 2.5 : 1.8;
      const baseOpacity = norm < 0.25 ? 0.8 : norm < 0.55 ? 0.5 : 0.22;
      const dur = (2.2 + norm * 1.8).toFixed(1);
      const anim = (r + c) % 3 === 0 ? "dp1" : (r + c) % 3 === 1 ? "dp2" : "dp3";

      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * gap + gap / 2}
          cy={r * gap + gap / 2}
          r={size}
          fill={`rgba(100,160,255,${baseOpacity})`}
          style={{ animation: `${anim} ${dur}s ease-in-out ${delay}s infinite` }}
        />
      );
    }
  }

  const w = cols * gap;
  const h = rows * gap;
  const pos: React.CSSProperties =
    corner === "tr" ? { top: 0, right: 0 } : { bottom: 0, left: 0 };

  return (
    <svg
      style={{ position: "absolute", width: w, height: h, pointerEvents: "none", overflow: "visible", ...pos }}
      viewBox={`0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {dots}
    </svg>
  );
}

export function SplashScreen() {
  // Start opacity:0 — the dark html/body background (set in layout <head>) covers
  // the white gap until we decide whether to show the splash or not.
  const [opacity, setOpacity] = useState(0);
  const [done, setDone] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    // Determine once (first invoke) whether we should show — persists through
    // Strict Mode's cleanup+remount cycle via the module-level object.
    if (!splashControl.initialized) {
      splashControl.initialized = true;
      splashControl.shouldShow = !sessionStorage.getItem(SPLASH_KEY);
      if (splashControl.shouldShow) {
        sessionStorage.setItem(SPLASH_KEY, "1");
      }
    }

    // Already shown this session — remove from DOM immediately
    if (!splashControl.shouldShow) {
      setDone(true);
      return;
    }

    // Show the splash (both Strict Mode invoke 1 and invoke 2 reach here;
    // invoke 1's timers get cancelled by cleanup, invoke 2's run to completion)
    setOpacity(1);
    const raf = requestAnimationFrame(() => setEntered(true));
    const t1 = setTimeout(() => setOpacity(0), DISPLAY_MS);
    const t2 = setTimeout(() => setDone(true), DISPLAY_MS + FADE_MS);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (done) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(170deg,#060d2e 0%,#091535 40%,#0b1e4a 70%,#0d2260 100%)",
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
        opacity,
        pointerEvents: "all",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes dp1{0%,100%{opacity:.15;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes dp2{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.8;transform:scale(1.2)}}
        @keyframes dp3{0%,100%{opacity:.1;transform:scale(.9)}50%{opacity:.6;transform:scale(1.1)}}
        @keyframes splashBar{0%{width:0%}90%{width:100%}100%{width:100%}}
        @keyframes glowPulse{0%,100%{opacity:.25;transform:scale(1)}50%{opacity:.45;transform:scale(1.08)}}
        @keyframes logoFloat{0%,100%{transform:translateY(0px)}50%{transform:translateY(-6px)}}
      `}</style>

      <WaveDots corner="tr" />
      <WaveDots corner="bl" />

      {/* Glow behind logo */}
      <div style={{
        position: "absolute", width: 280, height: 280, borderRadius: "50%",
        background: "radial-gradient(circle,rgba(37,99,235,0.35) 0%,transparent 70%)",
        animation: "glowPulse 3s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{
        transition: "transform 0.8s cubic-bezier(0.34,1.56,0.64,1), opacity 0.7s ease",
        transform: entered ? "scale(1) translateY(0)" : "scale(0.5) translateY(24px)",
        opacity: entered ? 1 : 0,
        marginBottom: 30,
        animation: entered ? "logoFloat 4s ease-in-out 1s infinite" : "none",
        position: "relative", zIndex: 1,
      }}>
        <img
          src="/attendix-logo.png"
          alt="Attendix"
          style={{
            width: 108, height: 108, borderRadius: 26, display: "block",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.12),0 8px 40px rgba(37,99,235,0.6),0 20px 60px rgba(0,0,0,0.5)",
          }}
        />
      </div>

      {/* App name */}
      <div style={{
        transition: "opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(14px)",
        textAlign: "center", marginBottom: 10, position: "relative", zIndex: 1,
      }}>
        <div style={{
          fontSize: "2.1rem", fontWeight: 800, color: "#ffffff", letterSpacing: "0.14em",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          textShadow: "0 0 40px rgba(100,160,255,0.5),0 2px 8px rgba(0,0,0,0.4)",
        }}>
          ATTENDIX
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        transition: "opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(10px)",
        marginBottom: 64, position: "relative", zIndex: 1,
      }}>
        <div style={{
          fontSize: "0.72rem", color: "rgba(100,160,255,0.85)", letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
          textShadow: "0 0 20px rgba(100,160,255,0.4)",
        }}>
          Smart Attendance Management
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        transition: "opacity 0.6s ease 0.7s",
        opacity: entered ? 1 : 0,
        width: 120, position: "relative", zIndex: 1,
      }}>
        <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg,#3b82f6,#60a5fa,#93c5fd)",
            borderRadius: 99,
            boxShadow: "0 0 12px rgba(96,165,250,0.8)",
            animation: entered ? `splashBar ${DISPLAY_MS}ms cubic-bezier(0.25,0.1,0.25,1) forwards` : "none",
          }} />
        </div>
      </div>
    </div>
  );
}
