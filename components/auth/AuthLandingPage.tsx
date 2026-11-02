import Link from "next/link";
import { RoleSelector } from "@/components/settings/RoleSelector";
import { LoginForm } from "@/components/auth/LoginForm";
import { isDemoRoleSelectorEnabled } from "@/lib/auth/demoUi";
import { resolveAuthProvider } from "@/lib/auth/request";
import { roleLabel, type Role } from "@/lib/auth/roles";
import { ssoLoginUrl } from "@/lib/auth/login";
import { APP_BRAND_INITIALS, APP_BRAND_NAME, APP_BRAND_TITLE } from "@/lib/appBrand";

type IconName = "sales" | "tempo" | "approval" | "stock" | "report";

function ModuleIcon({ name }: { name: IconName }) {
  if (name === "sales") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M5 3.75h14A1.25 1.25 0 0 1 20.25 5v14A1.25 1.25 0 0 1 19 20.25H5A1.25 1.25 0 0 1 3.75 19V5A1.25 1.25 0 0 1 5 3.75Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "tempo") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M12 21.25a9.25 9.25 0 1 0-8.4-5.38" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
        <path d="M3 21v-5h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "approval") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="m7.5 12 3 3 6-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        <path d="M12 21.25a9.25 9.25 0 1 0 0-18.5 9.25 9.25 0 0 0 0 18.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (name === "stock") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path d="M4 8.5 12 4l8 4.5-8 4.5L4 8.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
        <path d="M4 8.5v7L12 20l8-4.5v-7M12 13v7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path d="M5 19.25h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M7 16v-5M12 16V7M17 16v-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <path d="M5 4.75h14v14.5H5z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function AuthLandingPage({ currentRole }: { currentRole: Role }) {
  const provider = resolveAuthProvider();
  const showRoleSelector = isDemoRoleSelectorEnabled();
  const loginUrl = ssoLoginUrl();
  const isTrustedHeader = provider === "trusted_header";
  const isLocalCredentials = provider === "local_credentials";
  const ssoReady = isTrustedHeader && Boolean(loginUrl);
  const loginHref = loginUrl || "";
  const appMode = process.env.NEXT_PUBLIC_APP_MODE === "production" ? "Production" : "Development";
  const modules: Array<{ label: string; description: string; icon: IconName }> = [
    { label: "Penjualan", description: "Input transaksi dan cetak bukti penjualan.", icon: "sales" },
    { label: "Tempo", description: "Pantau piutang, pembayaran, dan sisa tagihan.", icon: "tempo" },
    { label: "Approval", description: "Validasi transaksi yang perlu persetujuan.", icon: "approval" },
    { label: "Stok", description: "Lihat barang, quantity, dan sinkronisasi ERP.", icon: "stock" },
    { label: "Laporan", description: "Ringkasan operasional dan finance.", icon: "report" }
  ];
  const statusItems = ["Sistem Internal", "Role Berjenjang", "PostgreSQL Ready"];

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] lg:items-stretch">
          {/* Main Card */}
          <div className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <div>
              <div className="flex flex-wrap gap-2">
                {statusItems.map((item) => (
                  <span key={item} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-700">
                    {item}
                  </span>
                ))}
              </div>

              <div className="mt-8 max-w-3xl">
                <p className="text-sm font-semibold text-blue-700">{APP_BRAND_NAME}</p>
                <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{APP_BRAND_TITLE}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                  Pusat kerja operasional untuk penjualan, tempo, approval, stok, dan laporan harian. Masuk sesuai peran untuk melanjutkan pekerjaan dengan data yang rapi dan terkontrol.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                {isLocalCredentials ? (
                  <div className="w-full max-w-md rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <LoginForm />
                  </div>
                ) : ssoReady ? (
                  <Link href={loginHref} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                    Masuk ke Sistem
                  </Link>
                ) : isTrustedHeader ? (
                  <button type="button" disabled className="inline-flex min-h-11 cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-500">
                    Masuk ke Sistem belum tersedia
                  </button>
                ) : null}
                {showRoleSelector ? (
                  <a href="#development-role-selector" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                    Pilih Role Development
                  </a>
                ) : null}
                <Link href="/no-access" className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-800">
                  Lihat status akses
                </Link>
              </div>
              {isTrustedHeader && !loginUrl ? (
                <p className="mt-3 text-sm font-medium text-amber-700">SSO perusahaan belum dikonfigurasi. Hubungi operator sistem.</p>
              ) : null}

              <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {modules.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition hover:border-blue-300 hover:bg-blue-50/50">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-blue-100 text-blue-700">
                      <ModuleIcon name={item.icon} />
                    </div>
                    <h2 className="mt-3 text-sm font-bold text-slate-900">{item.label}</h2>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Info */}
          <aside className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white">{APP_BRAND_INITIALS}</span>
                <div>
                  <p className="text-sm font-bold text-slate-900">Status Akses</p>
                  <p className="text-xs text-slate-500">Kontrol masuk aplikasi internal</p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mode Aplikasi</p>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-base font-bold text-slate-900">{appMode}</p>
                    <span className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{roleLabel(currentRole)}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Akses Masuk</p>
                  <p className="mt-1.5 text-xs leading-5 text-slate-600">
                    {isLocalCredentials ? "Masuk memakai email atau username yang dibuat Super Admin." : showRoleSelector ? "Gunakan role development untuk menguji alur kerja lokal." : "Gunakan akses perusahaan untuk masuk ke sistem."}
                  </p>
                </div>

                {isLocalCredentials ? (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-xs leading-5 text-blue-900">
                    <p className="font-bold text-blue-950">Login internal aktif</p>
                    <p className="mt-0.5">Role dan permission mengikuti data user yang tersimpan di database.</p>
                  </div>
                ) : isTrustedHeader && !loginUrl ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
                    <p className="font-bold">Login belum tersedia</p>
                    <p className="mt-0.5">Operator perlu mengisi <code className="font-semibold">AUTH_SSO_LOGIN_URL</code> sebelum user dapat masuk melalui SSO.</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3.5 text-xs leading-5 text-blue-900">
                    {ssoReady ? "Login SSO siap digunakan." : "Akses halaman kerja mengikuti role aktif yang tersimpan untuk pengguna."}
                  </div>
                )}
              </div>
            </div>

            <p className="mt-6 text-xs leading-5 text-slate-500 border-t border-slate-200 pt-4">
              Jika akses belum sesuai, minta Super Admin memperbarui hak akses pengguna Anda di Pengaturan.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
