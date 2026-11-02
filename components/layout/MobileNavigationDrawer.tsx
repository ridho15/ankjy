"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { APP_BRAND_INITIALS, APP_BRAND_NAME } from "@/lib/appBrand";
import { isNavLinkActive, visibleNavGroups } from "./navigation";

export function MobileNavigationDrawer({ role, userName }: { role: Role; userName: string }) {
  const pathname = usePathname();
  const [drawerState, setDrawerState] = useState({ open: false, pathname });
  const open = drawerState.open && drawerState.pathname === pathname;
  const groups = visibleNavGroups(role);
  const setOpen = (nextOpen: boolean) => setDrawerState({ open: nextOpen, pathname });

  return (
    <div className="lg:hidden">
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white shadow-sm">
            {APP_BRAND_INITIALS}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900 leading-tight">{APP_BRAND_NAME}</p>
            <p className="truncate text-[11px] text-slate-500">{roleLabel(role)} &bull; {userName}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Buka menu"
          aria-controls="mobile-navigation-drawer"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <span aria-hidden="true" className="space-y-1">
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
            <span className="block h-0.5 w-4 bg-current" />
          </span>
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup overlay menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
          />
          <aside
            id="mobile-navigation-drawer"
            aria-label="Menu navigasi"
            className="absolute bottom-0 left-0 top-0 flex w-[min(85vw,20rem)] flex-col border-r border-slate-200 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white shadow-sm">
                  {APP_BRAND_INITIALS}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 leading-tight">{APP_BRAND_NAME}</p>
                  <p className="truncate text-xs text-slate-500">{roleLabel(role)}</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 text-lg leading-none text-slate-700 transition hover:bg-slate-100"
              >
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
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
                          onClick={() => setOpen(false)}
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

            <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 font-medium">
              Operasional harian &bull; akses sesuai role
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
