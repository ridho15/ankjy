import { roleLabel } from "@/lib/auth/roles";
import Link from "next/link";
import { DemoLogoutButton } from "./DemoLogoutButton";
import { LogoutButton } from "./LogoutButton";
import { Breadcrumbs } from "./Breadcrumbs";
import type { UserProfile } from "@/lib/users/profile";
import { APP_BRAND_INITIALS, APP_BRAND_TITLE } from "@/lib/appBrand";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || APP_BRAND_INITIALS;
}

export function Header({ user, showDemoLogout = false, showLogout = false }: { user: UserProfile; showDemoLogout?: boolean; showLogout?: boolean }) {
  const date = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <Breadcrumbs />
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{APP_BRAND_TITLE}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 sm:justify-end">
        <span className="hidden border-r border-slate-200 pr-3 text-slate-500 sm:block">{date}</span>
        
        <details className="relative">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 transition hover:border-blue-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-blue-100 text-xs font-bold text-blue-800">
              {initials(user.name)}
            </span>
            <span className="text-left">
              <span className="block max-w-36 truncate font-semibold text-slate-800">{user.name}</span>
              <span className="block text-[10px] text-slate-500 font-medium">{roleLabel(user.role)}</span>
            </span>
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
          </summary>
          
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-md">
            <div className="border-b border-slate-100 pb-2">
              <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
              {user.email && <p className="mt-0.5 truncate text-xs text-slate-500">{user.email}</p>}
            </div>
            
            <div className="mt-2 space-y-1">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
                </svg>
                <span>Profil</span>
              </Link>
              
              {showLogout ? (
                <LogoutButton
                  label="Logout"
                  className="mt-1 w-full justify-start rounded-md border-0 px-2.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-red-50 hover:text-red-700"
                />
              ) : null}
              {showDemoLogout ? <DemoLogoutButton /> : null}
            </div>
          </div>
        </details>

        <span className="rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
          {process.env.NEXT_PUBLIC_APP_MODE === "production" ? "Produksi" : "Development"}
        </span>
      </div>
    </header>
  );
}
