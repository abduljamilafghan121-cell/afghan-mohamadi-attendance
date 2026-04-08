import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "success";

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex h-11 select-none touch-manipulation items-center justify-center rounded-xl px-4 text-sm font-medium transition-all focus:outline-none focus:ring-4 disabled:opacity-80 disabled:cursor-not-allowed active:scale-[0.96] active:opacity-80";

  const styles: Record<Variant, string> = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-800 focus:ring-zinc-200",
    secondary:
      "bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 focus:ring-zinc-100",
    danger: "bg-red-600 text-white hover:bg-red-500 focus:ring-red-100",
    success: "bg-emerald-600 text-white cursor-not-allowed focus:ring-emerald-100",
  };

  return (
    <button {...props} className={`${base} ${styles[variant]} ${props.className ?? ""}`} />
  );
}
