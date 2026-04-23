"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setProgress(15);

    const t1 = setTimeout(() => setProgress(45), 100);
    const t2 = setTimeout(() => setProgress(70), 300);
    const t3 = setTimeout(() => setProgress(90), 700);
    const t4 = setTimeout(() => {
      setProgress(100);
      const t5 = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
      timers.current.push(t5);
    }, 900);

    timers.current.push(t1, t2, t3, t4);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]"
        style={{
          width: `${progress}%`,
          transition: "width 250ms ease-out",
        }}
      />
    </div>
  );
}
