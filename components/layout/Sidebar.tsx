"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { APP_BRAND_INITIALS, APP_BRAND_NAME } from "@/lib/appBrand";
import { isNavLinkActive, visibleNavGroups } from "./navigation";

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const groups = visibleNavGroups(role);

  return (
    <aside className="hidden shrink-0 border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:border-r lg:overflow-hidden">
      <div className="flex h-full flex-col">
        {/* Brand Header */}
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white shadow-sm">
            {APP_BRAND_INITIALS}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 leading-tight">{APP_BRAND_NAME}</p>
            <p className="truncate text-xs text-slate-500 font-medium">{roleLabel(role)}</p>
          </div>
        </div>

        {/* Navigation Links Grouped */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Navigasi Utama">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {group.category}
              </p>
              <div className="space-y-0.5">
                {group.links.map((link) => {
                  const active = isNavLinkActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <span className={`grid h-4 w-4 place-items-center text-sm leading-none ${active ? "text-white" : "text-slate-400"}`}>
                        {link.icon}
                      </span>
                      <span className="truncate">{link.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer info */}
        <div className="border-t border-slate-200 px-5 py-3.5 text-xs text-slate-500 font-medium">
          Operasional Toko &bull; {roleLabel(role)}
        </div>
      </div>
    </aside>
  );
}
