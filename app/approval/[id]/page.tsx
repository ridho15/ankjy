import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { can } from "@/lib/auth/roles";
import { getCurrentRole } from "@/lib/auth/session";
import { getApprovalRequest } from "@/lib/approval/store";
import { ApprovalActionForm } from "@/components/approval/ApprovalActionForm";

export const dynamic = "force-dynamic";

export default async function ApprovalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const role = await getCurrentRole();
  if (!can(role, "approval.view")) redirect("/");
  const item = await getApprovalRequest(id);
  if (!item) redirect("/approval");
  const canPrintSale = item.module === "penjualan" && item.status === "approved" && item.entityId;

  return (
    <AppShell>
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Approval • Detail</span>
            <span className="text-slate-300">•</span>
            <span className="font-mono text-xs font-semibold text-slate-500">{item.id}</span>
          </div>
          <h2 className="aj-page-title text-3xl font-bold">Detail Approval</h2>
          <p className="mt-1 text-sm text-slate-600 capitalize">
            {item.module} • <span className="font-semibold text-slate-800">{item.status}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/approval"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
          >
            ← Kembali
          </Link>
          {canPrintSale && (
            <Link
              href={`/print/sales/${item.entityId}`}
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            >
              Cetak Penjualan
            </Link>
          )}
        </div>
      </div>
      <section className="aj-surface max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Info label="Module" value={item.module} />
          <Info label="Tipe" value={item.tipeCodeSnapshot || "-"} />
          <Info label="Created by" value={`${item.createdByNameSnapshot} (${item.createdByRoleSnapshot})`} />
          <Info
            label="Nominal"
            value={new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.amount || 0)}
            isMono
          />
          <Info label="Status" value={item.status} />
          <Info label="Referensi Dokumen" value={item.entityId} isMono />
        </dl>
        {item.module === "penjualan" && item.status === "pending_approval" && (
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            Cetak final dokumen tersedia setelah approval disetujui.
          </p>
        )}
        {item.status === "pending_approval" && can(role, "approval.approve") && <ApprovalActionForm id={item.id} />}
      </section>
    </AppShell>
  );
}

function Info({ label, value, isMono = false }: { label: string; value: string; isMono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-1 font-semibold text-slate-900 ${isMono ? "font-mono tabular-nums" : ""}`}>{value}</dd>
    </div>
  );
}
