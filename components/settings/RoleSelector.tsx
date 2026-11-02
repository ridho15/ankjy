"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { ROLES, roleLabel, type Role } from "@/lib/auth/roles";

export function RoleSelector({ currentRole, redirectTo = "/" }: { currentRole: Role; redirectTo?: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(currentRole);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const response = await fetch("/api/session/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });
    setSaving(false);
    if (response.ok) {
      router.push(redirectTo);
      router.refresh();
    }
  };

  return (
    <section className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
      <p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-600">Development Access</p>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-slate-950">Pilih role development</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Super Admin memiliki akses penuh. Admin fokus input Penjualan, Pengeluaran, dan Stock Barang. Finance menangani Tempo/pengeluaran. Manager fokus approval dan akses baca laporan/riwayat. Viewer default tanpa akses.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Select value={role} onChange={(event) => setRole(event.target.value as Role)}>
          {ROLES.map((item) => <option key={item} value={item}>{roleLabel(item)}</option>)}
        </Select>
        <Button type="button" onClick={save} disabled={saving} className="bg-blue-600 text-white hover:bg-blue-700 shadow-xs">
          {saving ? "Menyimpan..." : "Terapkan peran"}
        </Button>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        Catatan: selector ini hanya untuk development/local testing. Production harus memakai akses perusahaan yang aman.
      </p>
    </section>
  );
}
