import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { can } from "@/lib/auth/roles";
import { getCurrentRole } from "@/lib/auth/session";
import { listApprovalRequestsPage } from "@/lib/approval/store";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 10;

type SearchParams = Record<string, string | string[] | undefined>;

function valueOf(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function toPage(value?: string) {
  const page = Number(value || "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function pageHref(params: SearchParams, key: "pendingPage" | "historyPage", page: number) {
  const next = new URLSearchParams();
  for (const [paramKey, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value && paramKey !== key) next.set(paramKey, value);
  }
  next.set(key, String(page));
  return `/approval?${next.toString()}`;
}

export default async function ApprovalPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const role = await getCurrentRole();
  if (!can(role, "approval.view")) redirect("/");
  const params = await searchParams || {};
  const pendingPage = toPage(valueOf(params, "pendingPage"));
  const historyPage = toPage(valueOf(params, "historyPage"));
  const [{ data: pending, meta: pendingMeta }, { data: history, meta: historyMeta }] = await Promise.all([
    listApprovalRequestsPage({ page: pendingPage, pageSize: PAGE_SIZE, filter: { status: "active" } }),
    listApprovalRequestsPage({ page: historyPage, pageSize: PAGE_SIZE, filter: { status: "history" } })
  ]);
  const rupiah = (value = 0) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
  const statusBadge = (status: string) => {
    if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-amber-200 bg-amber-50 text-amber-700";
  };

  return (
    <AppShell>
      <div className="mb-7">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.13em] text-blue-600">Manager / Super Admin</p>
        <h2 className="aj-page-title text-3xl font-bold">Approval</h2>
        <p className="mt-2 text-sm text-slate-600">Approve atau reject transaksi yang menunggu pemeriksaan.</p>
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <h3 className="text-lg font-bold text-slate-900">Menunggu Approval</h3>
          {pendingMeta.total > 0 && (
            <span className="rounded-md bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-xs">
              {pendingMeta.total}
            </span>
          )}
        </div>
        <div className="aj-surface overflow-hidden rounded-xl border border-slate-200">
          {/* Mobile View */}
          <div className="space-y-3 p-4 md:hidden">
            {pending.map((row) => (
              <article key={row.id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold capitalize text-slate-900">{row.module}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.createdAt))}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono tabular-nums font-extrabold text-slate-900">{rupiah(row.amount)}</p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Tipe</dt>
                    <dd className="mt-0.5 font-medium text-slate-800">{row.tipeCodeSnapshot || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dibuat oleh</dt>
                    <dd className="mt-0.5 text-slate-800">
                      {row.createdByNameSnapshot} <span className="text-xs text-slate-500 font-normal">({row.createdByRoleSnapshot})</span>
                    </dd>
                  </div>
                </dl>
                <Link
                  className="mt-4 block rounded-lg bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
                  href={`/approval/${row.id}`}
                >
                  Approve / Reject
                </Link>
              </article>
            ))}
            {pending.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Tidak ada transaksi yang menunggu approval.</p>}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm divide-y divide-slate-200">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Module</th>
                  <th className="px-5 py-3.5">Tipe</th>
                  <th className="px-5 py-3.5">Created by</th>
                  <th className="px-5 py-3.5 text-right font-mono">Nominal</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 bg-amber-50/20">
                {pending.map((row) => (
                  <tr key={row.id} className="hover:bg-amber-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.createdAt))}
                    </td>
                    <td className="px-5 py-4 capitalize font-semibold text-slate-900">{row.module}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {row.tipeCodeSnapshot || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {row.createdByNameSnapshot}
                      <span className="ml-2 text-xs text-slate-500 font-normal">({row.createdByRoleSnapshot})</span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums font-bold text-slate-900">{rupiah(row.amount)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        className="inline-flex items-center rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors"
                        href={`/approval/${row.id}`}
                      >
                        Approve / Reject →
                      </Link>
                    </td>
                  </tr>
                ))}
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                      Tidak ada transaksi yang menunggu approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination current={pendingMeta.page} totalPages={pendingMeta.totalPages} hrefFor={(page) => pageHref(params, "pendingPage", page)} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-bold text-slate-900">Riwayat Approval</h3>
        <div className="aj-surface overflow-hidden rounded-xl border border-slate-200">
          {/* Mobile View */}
          <div className="space-y-3 p-4 md:hidden">
            {history.map((row) => (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold capitalize text-slate-900">{row.module}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.createdAt))}
                    </p>
                  </div>
                  <span className={`rounded-md border px-2.5 py-0.5 text-xs font-bold ${statusBadge(row.status)}`}>
                    {row.status}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Nominal</dt>
                    <dd className="mt-0.5 font-mono tabular-nums font-bold text-slate-900">{rupiah(row.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dibuat oleh</dt>
                    <dd className="mt-0.5 text-slate-800">
                      {row.createdByNameSnapshot} <span className="text-xs text-slate-500 font-normal">({row.createdByRoleSnapshot})</span>
                    </dd>
                  </div>
                </dl>
                <Link
                  className="mt-4 block rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  href={`/approval/${row.id}`}
                >
                  Lihat Detail
                </Link>
              </article>
            ))}
            {history.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Belum ada riwayat approval.</p>}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm divide-y divide-slate-200">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5">Tanggal</th>
                  <th className="px-5 py-3.5">Module</th>
                  <th className="px-5 py-3.5">Tipe</th>
                  <th className="px-5 py-3.5">Created by</th>
                  <th className="px-5 py-3.5 text-right font-mono">Nominal</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {history.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-slate-600">
                      {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(row.createdAt))}
                    </td>
                    <td className="px-5 py-4 capitalize font-medium text-slate-900">{row.module}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {row.tipeCodeSnapshot || "-"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-700">
                      {row.createdByNameSnapshot}
                      <span className="ml-2 text-xs text-slate-500 font-normal">({row.createdByRoleSnapshot})</span>
                    </td>
                    <td className="px-5 py-4 text-right font-mono tabular-nums font-semibold text-slate-900">{rupiah(row.amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-md border px-2.5 py-0.5 text-xs font-bold ${statusBadge(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                        href={`/approval/${row.id}`}
                      >
                        Lihat →
                      </Link>
                    </td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Belum ada riwayat approval.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination current={historyMeta.page} totalPages={historyMeta.totalPages} hrefFor={(page) => pageHref(params, "historyPage", page)} />
        </div>
      </section>
    </AppShell>
  );
}

function Pagination({ current, totalPages, hrefFor }: { current: number; totalPages: number; hrefFor: (page: number) => string }) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 text-sm">
      <span className="text-slate-500">Halaman {current} dari {totalPages}</span>
      <div className="flex gap-2">
        {current > 1 && (
          <Link
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            href={hrefFor(current - 1)}
          >
            Sebelumnya
          </Link>
        )}
        {current < totalPages && (
          <Link
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            href={hrefFor(current + 1)}
          >
            Berikutnya
          </Link>
        )}
      </div>
    </div>
  );
}
