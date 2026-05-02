"use client";

import { useEffect, useState } from "react";

const SPLASH_KEY = "attendix_splash_shown";
const DISPLAY_MS = 7000;
const FADE_MS = 700;

/* Dot grid used for the corner wave decorations */
function WaveDots({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const cols = 9;
  const rows = 9;
  const gap = 22;

  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dist = Math.sqrt(
        (corner === "tr" || corner === "br" ? cols - 1 - c : c) ** 2 +
        (corner === "bl" || corner === "br" ? rows - 1 - r : r) ** 2
      );
      const maxDist = Math.sqrt((cols - 1) ** 2 + (rows - 1) ** 2);
      const norm = dist / maxDist;
      if (norm > 0.85) continue;

      const delay = (r * 0.08 + c * 0.06 + Math.random() * 0.3).toFixed(2);
      const size = norm < 0.3 ? 3.5 : norm < 0.6 ? 2.5 : 1.8;
      const opacity = norm < 0.25 ? 0.75 : norm < 0.55 ? 0.45 : 0.2;
      const animName = (r + c) % 3 === 0 ? "dotPulse1" : (r + c) % 3 === 1 ? "dotPulse2" : "dotPulse3";

      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={c * gap + gap / 2}
          cy={r * gap + gap / 2}
          r={size}
          fill={`rgba(100,160,255,${opacity})`}
          style={{
            animation: `${animName} ${(2.4 + norm * 1.6).toFixed(1)}s ease-in-out ${delay}s infinite`,
          }}
        />
      );
    }
  }

  const w = cols * gap;
  const h = rows * gap;

  const style: React.CSSProperties = {
    position: "absolute",
    width: w,
    height: h,
    ...(corner === "tr" ? { top: 0, right: 0 } : {}),
    ...(corner === "bl" ? { bottom: 0, left: 0 } : {}),
    ...(corner === "tl" ? { top: 0, left: 0 } : {}),
    ...(corner === "br" ? { bottom: 0, right: 0 } : {}),
    pointerEvents: "none",
    overflow: "visible",
  };

  return (
    <svg style={style} viewBox={`0 0 ${w} ${h}`} xmlns="http://www.w3.org/2000/svg">
      {dots}
    </svg>
  );
}

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "enter" | "hold" | "exit">("hidden");

  useEffect(() => {
    if (sessionStorage.getItem(SPLASH_KEY)) return;
    sessionStorage.setItem(SPLASH_KEY, "1");

    let raf: number;
    const t0 = setTimeout(() => {
      raf = requestAnimationFrame(() => setPhase("enter"));
    }, 10);
    const t1 = setTimeout(() => setPhase("exit"), DISPLAY_MS);
    const t2 = setTimeout(() => setPhase("hidden"), DISPLAY_MS + FADE_MS);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (phase === "hidden") return null;

  const entered = phase === "enter" || phase === "hold";
  const exiting = phase === "exit";

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
        background: "linear-gradient(170deg, #060d2e 0%, #091535 40%, #0b1e4a 70%, #0d2260 100%)",
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
        opacity: exiting ? 0 : 1,
        pointerEvents: "all",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes dotPulse1 {
          0%, 100% { opacity: 0.15; transform: scale(0.85); }
          50%       { opacity: 1;    transform: scale(1.15); }
        }
        @keyframes dotPulse2 {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50%       { opacity: 0.8;  transform: scale(1.2); }
        }
        @keyframes dotPulse3 {
          0%, 100% { opacity: 0.1; transform: scale(0.9); }
          50%       { opacity: 0.6; transform: scale(1.1); }
        }
        @keyframes splashBar {
          0%   { width: 0%; }
          90%  { width: 100%; }
          100% { width: 100%; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50%       { opacity: 0.45; transform: scale(1.08); }
        }
        @keyframes logoFloat {
          0%, 100% { transform: scale(1) translateY(0px); }
          50%       { transform: scale(1) translateY(-5px); }
        }
      `}</style>

      {/* Corner wave dot grids */}
      <WaveDots corner="tr" />
      <WaveDots corner="bl" />

      {/* Central radial glow behind logo */}
      <div style={{
        position: "absolute",
        width: 280,
        height: 280,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)",
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
        position: "relative",
        zIndex: 1,
      }}>
        <img
          src="/attendix-logo.png"
          alt="Attendix"
          style={{
            width: 108,
            height: 108,
            borderRadius: 26,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.12), 0 8px 40px rgba(37,99,235,0.6), 0 20px 60px rgba(0,0,0,0.5)",
            display: "block",
          }}
        />
      </div>

      {/* App name */}
      <div style={{
        transition: "opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(14px)",
        textAlign: "center",
        marginBottom: 10,
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{
          fontSize: "2.1rem",
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: "0.14em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textShadow: "0 0 40px rgba(100,160,255,0.5), 0 2px 8px rgba(0,0,0,0.4)",
        }}>
          ATTENDIX
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        transition: "opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(10px)",
        marginBottom: 64,
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{
          fontSize: "0.72rem",
          color: "rgba(100,160,255,0.85)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textShadow: "0 0 20px rgba(100,160,255,0.4)",
        }}>
          Smart Attendance Management
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        transition: "opacity 0.6s ease 0.7s",
        opacity: entered ? 1 : 0,
        width: 120,
        position: "relative",
        zIndex: 1,
      }}>
        <div style={{
          height: 3,
          background: "rgba(255,255,255,0.1)",
          borderRadius: 99,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "linear-gradient(90deg, #3b82f6, #60a5fa, #93c5fd)",
            borderRadius: 99,
            boxShadow: "0 0 12px rgba(96,165,250,0.8)",
            animation: `splashBar ${DISPLAY_MS}ms cubic-bezier(0.25,0.1,0.25,1) forwards`,
          }} />
        </div>
      </div>
    </div>
  );
}
