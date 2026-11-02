import type { SelectHTMLAttributes } from "react";
export function Select({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`block w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 ${className}`} {...props}>{children}</select>;
}
