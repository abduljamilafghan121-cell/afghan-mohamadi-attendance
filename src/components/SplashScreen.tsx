"use client";

import { useLayoutEffect, useRef, useState } from "react";

const SPLASH_KEY = "attendix_splash_shown";
const DISPLAY_MS = 4000;
const FADE_MS = 600;

export function SplashScreen() {
  /**
   * Phases:
   *  "hidden"  → returns null (before splash needed, or after it finishes)
   *  "loading" → overlay is painted immediately (covers the white background)
   *              inner elements are still opacity-0 — set synchronously in
   *              useLayoutEffect so it appears BEFORE the browser's first paint
   *  "enter"   → inner elements animate in (set via rAF on the next frame)
   *  "exit"    → overlay fades out
   */
  const [phase, setPhase] = useState<"hidden" | "loading" | "enter" | "exit">(
    "hidden"
  );

  /**
   * useRef guard — survives the React Strict Mode cleanup/re-invoke cycle.
   * Without this, the double-invocation in dev mode cancels the timers on
   * cleanup, then the second run hits the sessionStorage guard and skips
   * re-creating them, so the splash never exits (or never enters).
   */
  const initialized = useRef(false);

  useLayoutEffect(() => {
    // Already initialised in this render tree (Strict Mode guard)
    if (initialized.current) return;
    // Already shown in this browser session
    if (sessionStorage.getItem(SPLASH_KEY)) return;

    initialized.current = true;
    // Mark as shown now — if something unmounts us we don't show it again
    sessionStorage.setItem(SPLASH_KEY, "1");

    // ── FIX 1: set to "loading" synchronously HERE (useLayoutEffect runs
    //    before the browser paints), so the blue overlay covers the white
    //    background on the very first frame — no white flash.
    setPhase("loading");

    // ── FIX 2: trigger the inner-element animation on the next frame so
    //    CSS transitions have a "from" state to animate from.
    const t0 = requestAnimationFrame(() => setPhase("enter"));

    // ── FIX 2 (cont): timers start from THIS point (when the overlay is
    //    already on screen) so DISPLAY_MS is accurate.
    const t1 = setTimeout(() => setPhase("exit"), DISPLAY_MS);
    const t2 = setTimeout(() => setPhase("hidden"), DISPLAY_MS + FADE_MS);

    return () => {
      // NOTE: we intentionally do NOT reset initialized.current here.
      // That keeps the Strict Mode second-run from re-initialising.
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
        background: "linear-gradient(160deg, #1a40c8 0%, #2563eb 45%, #1e88e5 100%)",
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4,0,0.2,1)`,
        opacity: exiting ? 0 : 1,
        pointerEvents: "all",
        userSelect: "none",
        overflow: "hidden",
      }}
    >
      {/* Background glow blobs */}
      <div style={{
        position: "absolute", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
        borderRadius: "50%", top: -100, right: -100, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)",
        borderRadius: "50%", bottom: -80, left: -60, pointerEvents: "none",
      }} />

      {/* Logo */}
      <div style={{
        transition: "transform 0.7s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease",
        transform: entered ? "scale(1) translateY(0)" : "scale(0.6) translateY(20px)",
        opacity: entered ? 1 : 0,
        marginBottom: 28,
      }}>
        <img
          src="/attendix-logo.png"
          alt="Attendix"
          style={{
            width: 120,
            height: 120,
            borderRadius: 28,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.15)",
            display: "block",
          }}
        />
      </div>

      {/* App name */}
      <div style={{
        transition: "opacity 0.6s ease 0.25s, transform 0.6s ease 0.25s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(10px)",
        textAlign: "center",
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: "2rem",
          fontWeight: 800,
          color: "#fff",
          letterSpacing: "0.08em",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          textShadow: "0 2px 16px rgba(0,0,0,0.2)",
        }}>
          ATTENDIX
        </div>
      </div>

      {/* Tagline */}
      <div style={{
        transition: "opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s",
        opacity: entered ? 1 : 0,
        transform: entered ? "translateY(0)" : "translateY(8px)",
        marginBottom: 56,
      }}>
        <div style={{
          fontSize: "0.85rem",
          color: "rgba(255,255,255,0.65)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}>
          Smart Attendance Management
        </div>
      </div>

      {/* Loading bar */}
      <div style={{
        transition: "opacity 0.5s ease 0.5s",
        opacity: entered ? 1 : 0,
        width: 140,
        position: "relative",
      }}>
        <div style={{
          height: 3,
          background: "rgba(255,255,255,0.18)",
          borderRadius: 99,
          overflow: "hidden",
        }}>
          <div style={{
            height: "100%",
            background: "#fff",
            borderRadius: 99,
            animation: `splashBar ${DISPLAY_MS}ms cubic-bezier(0.4,0,0.6,1) forwards`,
          }} />
        </div>
      </div>

      <style>{`
        @keyframes splashBar {
          0%   { width: 0%; opacity: 1; }
          85%  { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
