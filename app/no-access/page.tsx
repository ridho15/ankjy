import { AppShell } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { RoleSelector } from "@/components/settings/RoleSelector";
import { isDemoRoleSelectorEnabled } from "@/lib/auth/demoUi";
import { resolveAuthProvider } from "@/lib/auth/request";
import { getCurrentRole } from "@/lib/auth/session";
import Link from "next/link";

export default async function NoAccessPage() {
  const role = await getCurrentRole();
  const showRoleSelector = isDemoRoleSelectorEnabled();
  const provider = resolveAuthProvider();
  const showLoginLink = !showRoleSelector && (provider === "trusted_header" || provider === "local_credentials" || provider === "anika_erp");

  return (
    <AppShell>
      <div className="mx-auto max-w-xl py-6">
        <section className="rounded-xl border border-slate-300 bg-white p-6 sm:p-8 shadow-sm">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
            Akses Dibatasi
          </div>
          
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Izin Akses Belum Diberikan
          </h1>
          
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Akun Anda saat ini memiliki peran <strong className="font-semibold text-slate-900">({role})</strong> yang belum memiliki izin untuk membuka halaman ini. Pastikan role pengguna Anda sudah diatur dengan benar oleh Super Admin (misalnya: <strong>Kasir</strong>, <strong>Delivery Driver</strong>, <strong>Admin</strong>, atau <strong>Supervisor</strong>).
          </p>
          
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
            <p className="font-medium text-slate-800">Catatan Sinkronisasi Role:</p>
            <p className="mt-0.5">
              Jika role akun baru saja diubah oleh Super Admin, silakan lakukan <strong>Keluar / Logout</strong> terlebih dahulu lalu login kembali agar data role terbaru tersimpan ke browser.
            </p>
          </div>

          {showLoginLink ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <LogoutButton
                label="Keluar / Login Ulang"
                className="!min-h-11 !rounded-lg !border-blue-600 !bg-blue-600 !px-4 !py-2.5 !text-sm !font-semibold !text-white hover:!bg-blue-700 transition-colors"
              />
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
              >
                Kembali ke Halaman Login
              </Link>
            </div>
          ) : null}
        </section>

        {showRoleSelector ? (
          <div className="mt-6">
            <RoleSelector currentRole={role} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
