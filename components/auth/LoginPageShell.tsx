import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { APP_BRAND_INITIALS, APP_BRAND_NAME, APP_BRAND_TITLE } from "@/lib/appBrand";

export function LoginPageShell() {
  const systemModules = [
    { name: "Kasir & Penjualan", desc: "Transaksi POS cepat dan cetak struk", code: "POS" },
    { name: "Piutang & Tempo", desc: "Pencatatan jatuh tempo dan reminder WA", code: "AR" },
    { name: "Manajemen Stok", desc: "Kartu stok, opname, dan delivery order", code: "INV" },
    { name: "Kamera & CCTV", desc: "Integrasi visual pengepakan barang", code: "CAM" },
    { name: "Buku Kas & Bank", desc: "Jurnal otomatis dan kontrol saldo COA", code: "GL" }
  ];

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm lg:grid lg:grid-cols-12">
        {/* Left Column: Solid Enterprise Branding & Overview */}
        <section className="bg-slate-900 p-8 sm:p-10 lg:col-span-5 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-blue-600 text-sm font-bold tracking-tight text-white">
                {APP_BRAND_INITIALS}
              </span>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">{APP_BRAND_TITLE}</h1>
                <p className="text-xs text-slate-400">Sistem Operasional Terintegrasi</p>
              </div>
            </div>

            <div className="mt-8">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-950/80 border border-blue-800/60 px-2.5 py-1 text-xs font-medium text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                Versi 1.0 Production
              </span>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Pusat Kendali Operasional Toko
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Masuk dengan akun internal Anda untuk memproses transaksi penjualan, mengelola stok barang, meninjau piutang tempo, dan mengakses laporan keuangan.
              </p>
            </div>

            <div className="mt-8 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Modul Terintegrasi</p>
              {systemModules.map((item) => (
                <div key={item.code} className="flex items-center gap-3 rounded-lg border border-slate-800/80 bg-slate-800/40 px-3 py-2">
                  <span className="grid h-6 w-7 place-items-center rounded bg-blue-900/60 font-mono text-[11px] font-bold text-blue-300">
                    {item.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-200">{item.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-800 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} {APP_BRAND_NAME}. Seluruh hak cipta dilindungi.</p>
          </div>
        </section>

        {/* Right Column: High-Precision Enterprise Login Form */}
        <section className="p-8 sm:p-10 lg:col-span-7 flex flex-col justify-center bg-white">
          <div className="w-full max-w-md mx-auto">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Masuk ke sistem
              </h2>
              <p className="mt-1.5 text-sm text-slate-600">
                Silakan masukkan email atau username dan password akun operasional Anda.
              </p>
            </div>

            <div className="mt-8">
              <LoginForm />
            </div>

            <div className="mt-8 border-t border-slate-200 pt-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
                <p>Hubungi Super Admin jika tidak bisa masuk.</p>
                <Link
                  href="/no-access"
                  className="font-medium text-blue-700 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                >
                  Lihat status izin akses →
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
