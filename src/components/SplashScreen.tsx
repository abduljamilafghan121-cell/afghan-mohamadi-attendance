"use client";

import { useLayoutEffect, useRef, useState } from "react";

const SPLASH_KEY = "attendix_splash_shown";
const DISPLAY_MS = 4000;
const FADE_MS = 800;

export function SplashScreen() {
  const [phase, setPhase] = useState<"hidden" | "loading" | "enter" | "exit">("hidden");
  const initialized = useRef(false);

  useLayoutEffect(() => {
    if (initialized.current) return;
    if (sessionStorage.getItem(SPLASH_KEY)) return;

    initialized.current = true;
    sessionStorage.setItem(SPLASH_KEY, "1");

    // Set "loading" synchronously — covers white background before first paint
    setPhase("loading");

    // Trigger enter animation on next frame
    const t0 = requestAnimationFrame(() => setPhase("enter"));

    // Start fade-out after full display time
    const t1 = setTimeout(() => setPhase("exit"), DISPLAY_MS);

    // Unmount after fade completes
    const t2 = setTimeout(() => setPhase("hidden"), DISPLAY_MS + FADE_MS);

    return () => {
      // NOTE: initialized.current is NOT reset here intentionally —
      // prevents React Strict Mode double-invoke from re-running the splash
      cancelAnimationFrame(t0);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "hidden") return null;

  const entered = phase === "enter";
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
        background: "#050c1f",
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
        opacity: exiting ? 0 : 1,
        overflow: "hidden",
        pointerEvents: "all",
        userSelect: "none",
      }}
    >
      {/* ── Deep gradient backdrop ── */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(30,64,175,0.45) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* ── Ambient top-left orb ── */}
      <div style={{
        position: "absolute", width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 65%)",
        top: -150, left: -120,
        animation: "floatOrb 8s ease-in-out infinite",
        pointerEvents: "none",
      }} />

      {/* ── Ambient bottom-right orb ── */}
      <div style={{
        position: "absolute", width: 400, height: 400, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 65%)",
        bottom: -100, right: -80,
        animation: "floatOrb 6s ease-in-out 2s infinite reverse",
        pointerEvents: "none",
      }} />

      {/* ── Subtle grid lines ── */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* ── Scan line sweep ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(to bottom, transparent 0%, rgba(56,189,248,0.04) 50%, transparent 100%)",
        animation: "scan 4s linear infinite",
      }} />

      {/* ══════════════════════════════════
           MAIN CONTENT
      ══════════════════════════════════ */}
      <div style={{
        position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center",
        marginBottom: 120,
      }}>

        {/* ── Pulsing ring aura behind logo ── */}
        <div style={{
          position: "absolute",
          width: 180, height: 180, borderRadius: "50%",
          border: "1px solid rgba(56,189,248,0.2)",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease 0.2s",
          opacity: entered ? 1 : 0,
          animation: entered ? "ringPulse 3s ease-in-out infinite" : "none",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          width: 220, height: 220, borderRadius: "50%",
          border: "1px solid rgba(56,189,248,0.1)",
          top: "50%", left: "50%",
          transform: "translate(-50%,-50%)",
          transition: "opacity 1s ease 0.4s",
          opacity: entered ? 1 : 0,
          animation: entered ? "ringPulse 3s ease-in-out 0.5s infinite" : "none",
          pointerEvents: "none",
        }} />

        {/* ── Your actual logo ── */}
        <div style={{
          transition: "transform 0.9s cubic-bezier(0.34,1.56,0.64,1), opacity 0.7s ease",
          transform: entered ? "scale(1) translateY(0)" : "scale(0.4) translateY(40px)",
          opacity: entered ? 1 : 0,
          marginBottom: 32,
          position: "relative", zIndex: 2,
        }}>
          <img
            src="/attendix-logo.png"
            alt="Attendix"
            style={{
              width: 110,
              height: 110,
              borderRadius: 28,
              display: "block",
              boxShadow: "0 0 60px rgba(56,189,248,0.25), 0 30px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
            }}
          />
        </div>

        {/* ── App name with gradient ── */}
        <div style={{
          transition: "opacity 0.7s ease 0.35s, transform 0.7s ease 0.35s",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(16px)",
          marginBottom: 10, textAlign: "center",
        }}>
          <div style={{
            fontSize: "2.6rem", fontWeight: 900,
            letterSpacing: "0.18em",
            fontFamily: "'Segoe UI', 'SF Pro Display', -apple-system, sans-serif",
            background: "linear-gradient(135deg, #ffffff 0%, #93c5fd 50%, #38bdf8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 0 30px rgba(56,189,248,0.4))",
          }}>
            ATTENDIX
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{
          transition: "opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s",
          opacity: entered ? 1 : 0,
          transform: entered ? "scaleX(1)" : "scaleX(0)",
          width: 160, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.6), transparent)",
          marginBottom: 12,
        }} />

        {/* ── Tagline ── */}
        <div style={{
          transition: "opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(10px)",
        }}>
          <div style={{
            fontSize: "0.72rem", color: "rgba(148,163,184,0.85)",
            letterSpacing: "0.28em", textTransform: "uppercase",
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            Smart Attendance Management
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════
           WAVE SECTION
      ══════════════════════════════════ */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        transition: "opacity 0.8s ease 0.5s",
        opacity: entered ? 1 : 0,
        height: 200,
      }}>
        {/* Wave 3 — back */}
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 0, left: 0, width: "200%", height: "100%",
            animation: "waveBack 9s ease-in-out infinite" }}>
          <defs>
            <linearGradient id="wg3" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(30,58,138,0.0)" />
              <stop offset="100%" stopColor="rgba(15,30,80,0.95)" />
            </linearGradient>
          </defs>
          <path
            d="M0,100 C240,30 480,170 720,100 C960,30 1200,170 1440,100 L1440,200 L0,200 Z"
            fill="url(#wg3)"
          />
        </svg>

        {/* Wave 2 — mid */}
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 0, left: 0, width: "200%", height: "85%",
            animation: "waveMid 6s ease-in-out infinite" }}>
          <defs>
            <linearGradient id="wg2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(29,78,216,0.0)" />
              <stop offset="100%" stopColor="rgba(29,78,216,0.7)" />
            </linearGradient>
          </defs>
          <path
            d="M0,70 C200,140 400,20 600,80 C800,140 1040,20 1200,80 C1320,120 1400,50 1440,70 L1440,200 L0,200 Z"
            fill="url(#wg2)"
          />
        </svg>

        {/* Wave 1 — front, cyan tinted */}
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 0, left: 0, width: "200%", height: "65%",
            animation: "waveFront 4s ease-in-out infinite" }}>
          <defs>
            <linearGradient id="wg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(56,189,248,0.0)" />
              <stop offset="100%" stopColor="rgba(14,116,144,0.85)" />
            </linearGradient>
          </defs>
          <path
            d="M0,55 C160,110 320,10 480,60 C640,115 800,15 960,58 C1120,105 1300,18 1440,55 L1440,200 L0,200 Z"
            fill="url(#wg1)"
          />
        </svg>

        {/* Glowing wave crest line */}
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 115, left: 0, width: "200%", height: 50,
            animation: "waveFront 4s ease-in-out infinite" }}>
          <path
            d="M0,55 C160,10 320,55 480,15 C640,55 800,10 960,50 C1120,10 1300,50 1440,20"
            fill="none" stroke="rgba(56,189,248,0.5)" strokeWidth="1.5"
          />
        </svg>

        {/* Solid base fill */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 40,
          background: "rgba(14,116,144,0.85)",
        }} />

        {/* Version badge */}
        <div style={{
          position: "absolute", bottom: 12, left: 0, right: 0,
          display: "flex", justifyContent: "center",
          transition: "opacity 0.5s ease 0.9s",
          opacity: entered ? 0.5 : 0,
        }}>
          <div style={{
            fontSize: "0.65rem", color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.2em", textTransform: "uppercase",
            fontFamily: "'Segoe UI', sans-serif",
          }}>
            v1.0.0
          </div>
        </div>
      </div>

      {/* ── Loading dots ── */}
      <div style={{
        position: "absolute", bottom: 95, left: 0, right: 0,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        transition: "opacity 0.5s ease 0.8s",
        opacity: entered ? 1 : 0,
        zIndex: 5,
      }}>
        <div style={{
          fontSize: "0.6rem", color: "rgba(148,163,184,0.6)",
          letterSpacing: "0.25em", textTransform: "uppercase",
          fontFamily: "'Segoe UI', sans-serif", marginBottom: 4,
        }}>
          Loading
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              animation: `dotFlow 1.5s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes waveBack  { 0%,100%{transform:translateX(0)}    50%{transform:translateX(-5%)} }
        @keyframes waveMid   { 0%,100%{transform:translateX(0)}    50%{transform:translateX(4%)}  }
        @keyframes waveFront { 0%,100%{transform:translateX(0)}    50%{transform:translateX(-3%)} }
        @keyframes dotFlow {
          0%,80%,100%{ transform:scale(0.7); opacity:0.3; }
          40%        { transform:scale(1.4); opacity:1; }
        }
        @keyframes ringPulse {
          0%,100%{ transform:translate(-50%,-50%) scale(1);    opacity:0.6; }
          50%    { transform:translate(-50%,-50%) scale(1.08); opacity:0.2; }
        }
        @keyframes floatOrb {
          0%,100%{ transform:translate(0,0); }
          50%    { transform:translate(20px,30px); }
        }
        @keyframes scan {
          0%  { transform:translateY(-100%); }
          100%{ transform:translateY(100vh); }
        }
      `}</style>
    </div>
  );
}
