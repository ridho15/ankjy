"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "./navigation";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  penjualan: "Penjualan",
  pengeluaran: "Pengeluaran",
  barang: "Stok Barang",
  "stok-barang": "Stok Barang",
  "delivery-orders": "Delivery Order",
  tempo: "Tempo & Piutang",
  approval: "Approval",
  akuntansi: "Akuntansi",
  pembelian: "Pembelian",
  sdm: "SDM & Personalia",
  reports: "Pusat Laporan",
  settings: "Pengaturan",
  "cctv-monitoring": "CCTV Monitoring",
  "audit-trail": "Audit Trail",
  "erp-sync": "Sinkronisasi ERP",
  profile: "Profil Pengguna",
  input: "Input Baru",
  draft: "Draft",
  retur: "Retur",
  print: "Cetak",
  edit: "Ubah",
  detail: "Rincian",
  coa: "Bagan Akun (COA)",
  "buku-besar": "Buku Besar",
  jurnal: "Jurnal Transaksi",
  "neraca-saldo": "Neraca Saldo",
  rekonsiliasi: "Rekonsiliasi Bank",
  "tutup-buku": "Tutup Buku",
  kurs: "Kurs Valas",
  karyawan: "Data Karyawan",
  gaji: "Slip Gaji",
  kasbon: "Kasbon Karyawan",
  simpanan: "Simpanan",
  organisasi: "Struktur Organisasi",
  users: "Kelola Pengguna",
  rekening: "Akun Bank & Kas",
  tipe: "Tipe Transaksi",
  whatsapp: "Notifikasi WhatsApp",
  "ai-forecast": "AI Prediksi Stok"
};

export function Breadcrumbs({ className = "" }: { className?: string }) {
  let pathname = "";
  try {
    pathname = usePathname() || "";
  } catch {
    pathname = "";
  }

  if (!pathname || pathname === "/login" || pathname === "/no-access") return null;

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // Build breadcrumb items
  const items = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join("/")}`;
    const matchedNav = NAV_LINKS.find((link) => link.href === path);
    const label = matchedNav?.label || ROUTE_LABELS[segment] || segment;
    const isLast = index === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs font-medium text-slate-500 ${className}`}>
      <ol className="flex items-center flex-wrap gap-1.5">
        <li>
          <Link
            href="/dashboard"
            className="flex items-center text-slate-500 hover:text-blue-700 transition-colors"
            title="Beranda Dashboard"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
            </svg>
            <span className="sr-only">Dashboard</span>
          </Link>
        </li>

        {items.map((item) => (
          <li key={item.path} className="flex items-center gap-1.5">
            <span className="text-slate-300" aria-hidden="true">/</span>
            {item.isLast ? (
              <span className="font-semibold text-slate-900" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.path}
                className="text-slate-500 hover:text-blue-700 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
