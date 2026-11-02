import type { ButtonHTMLAttributes } from "react";

export function Button({
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    secondary:
      "bg-white text-slate-700 border border-slate-300 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-xs focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-offset-2"
  };
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
