import { ReactNode } from "react";

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        </div>
      ) : null}
      {children}
    </div>
  );
}
