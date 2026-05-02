"use client";

import { useEffect, useState } from "react";

export function OfflineGuard() {
  const [offline, setOffline] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setOffline(true);
      requestAnimationFrame(() => setVisible(true));
    };
    const goOnline = () => {
      setVisible(false);
      setTimeout(() => setOffline(false), 400);
    };

    if (!navigator.onLine) {
      setOffline(true);
      setTimeout(() => setVisible(true), 50);
    }

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%)",
        transition: "opacity 0.4s ease",
        opacity: visible ? 1 : 0,
        pointerEvents: "all",
      }}
    >
      <div
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 28,
          padding: "48px 40px",
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 32px 64px rgba(0,0,0,0.25)",
          color: "#fff",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          transform: visible ? "scale(1) translateY(0)" : "scale(0.95) translateY(16px)",
          transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Logo */}
        <img
          src="/attendix-logo.png"
          alt="Attendix"
          style={{
            width: 88,
            height: 88,
            borderRadius: 20,
            display: "block",
            margin: "0 auto 24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
          }}
        />

        {/* WiFi-off icon */}
        <div
          style={{
            width: 64,
            height: 64,
            background: "rgba(255,255,255,0.12)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
          </svg>
        </div>

        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 10, letterSpacing: "-0.02em" }}>
          No Internet Connection
        </h2>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.72)", lineHeight: 1.6, marginBottom: 28 }}>
          You are currently offline. Please check your Wi-Fi or mobile data. All changes are paused until you reconnect.
        </p>

        {/* Reconnecting indicator */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
          <WaitingDots />
          <span>Waiting for connection</span>
        </div>
      </div>
    </div>
  );
}

function WaitingDots() {
  return (
    <span style={{ display: "flex", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.6)",
            display: "inline-block",
            animation: `offlinePulse 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes offlinePulse {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </span>
  );
}
