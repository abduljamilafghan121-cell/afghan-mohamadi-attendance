"use client";

import { useEffect } from "react";

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export function AppResumeHandler() {
  useEffect(() => {
    let lastHiddenAt: number | null = null;

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAt = Date.now();
      } else if (document.visibilityState === "visible") {
        if (lastHiddenAt && Date.now() - lastHiddenAt > STALE_THRESHOLD_MS) {
          lastHiddenAt = null;
          window.location.reload();
        } else {
          lastHiddenAt = null;
        }
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.location.reload();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
