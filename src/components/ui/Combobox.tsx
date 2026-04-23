"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ComboOption = {
  id: string;
  label: string;
  hint?: string;
};

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Search…",
  emptyText = "No matches",
  disabled,
  className,
  allowClear = true,
}: {
  options: ComboOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value) ?? null, [options, value]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current && wrapRef.current.contains(target)) return;
      const menu = document.getElementById("combobox-portal-open");
      if (menu && menu.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      if (!wrapRef.current) return;
      const r = wrapRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 50);
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = filtered[highlight];
      if (f) pick(f.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <div
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`flex h-11 w-full cursor-text items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 text-sm ${
          disabled ? "opacity-60" : "focus-within:border-zinc-300 focus-within:ring-4 focus-within:ring-zinc-100"
        }`}
      >
        {open ? (
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none placeholder:text-zinc-400"
          />
        ) : (
          <span className={`flex-1 truncate ${selected ? "text-zinc-900" : "text-zinc-400"}`}>
            {selected ? selected.label : placeholder}
          </span>
        )}
        {allowClear && selected && !open && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-xs text-zinc-400 hover:text-zinc-700"
            aria-label="Clear"
          >
            ✕
          </button>
        ) : null}
        <svg className="h-3.5 w-3.5 text-zinc-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </div>

      {open && menuPos && typeof document !== "undefined" &&
        createPortal(
          <div
            id="combobox-portal-open"
            style={{
              position: "fixed",
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              zIndex: 1000,
            }}
            className="max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-zinc-500">{emptyText}</div>
            ) : (
              filtered.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.id)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-zinc-100" : ""
                  } ${o.id === value ? "font-medium text-zinc-900" : "text-zinc-700"}`}
                >
                  <span className="truncate">{o.label}</span>
                  {o.hint ? <span className="ml-2 shrink-0 text-xs text-zinc-500">{o.hint}</span> : null}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
