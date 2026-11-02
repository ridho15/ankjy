import "server-only";
import { listErpPaginated } from "@/lib/api/pagination";
import type { ApiResponse } from "@/lib/types/api";
import { prisma } from "@/lib/db/prisma";

export type ErpReferenceOption = {
  id: number;
  name: string;
  code?: string;
};

function isLocalInventoryMode(): boolean {
  return process.env.INVENTORY_SOURCE !== "erp";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function numberId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toReferenceOption(row: unknown): ErpReferenceOption | undefined {
  const item = asRecord(row);
  const id = numberId(item?.id);
  const name = text(item?.name) ?? text(item?.abbreviation) ?? text(item?.kode) ?? text(item?.code);
  if (!id || !name) return undefined;
  return { id, name, code: text(item?.kode) ?? text(item?.code) ?? text(item?.abbreviation) };
}

function uniqueById(rows: ErpReferenceOption[]) {
  return Array.from(new Map(rows.map((row) => [row.id, row])).values());
}

export async function listProductCategories(): Promise<ApiResponse<ErpReferenceOption[]>> {
  if (isLocalInventoryMode()) {
    const defaults = ["Material Bangunan", "Cat & Finishing", "Perkakas", "Sanitari", "Kelistrikan", "Lain - Lain", "Umum"];
    const rows = await prisma.product.findMany({
      select: { category: true },
      distinct: ["category"],
    }).catch(() => []);
    const names = Array.from(new Set([...defaults, ...rows.map((r) => r.category).filter(Boolean)]));
    return {
      success: true,
      data: names.map((name, index) => ({ id: index + 1, name, code: name.toUpperCase() })),
    };
  }

  const response = await listErpPaginated("/product-categories", { maxPages: 5 });
  if (!response.success) return response;
  return { success: true, data: uniqueById(response.data.map(toReferenceOption).filter((item): item is ErpReferenceOption => Boolean(item))) };
}

export async function listUnitOfMeasures(): Promise<ApiResponse<ErpReferenceOption[]>> {
  if (isLocalInventoryMode()) {
    const defaults = ["PCS", "SAK", "KG", "METER", "LUSIN", "DUS", "ROLL", "KALENG", "LEMBAR"];
    const rows = await prisma.product.findMany({
      select: { unit: true },
      distinct: ["unit"],
    }).catch(() => []);
    const names = Array.from(new Set([...defaults, ...rows.map((r) => r.unit).filter(Boolean)]));
    return {
      success: true,
      data: names.map((name, index) => ({ id: index + 1, name, code: name.toUpperCase() })),
    };
  }

  const response = await listErpPaginated("/unit-of-measures", { maxPages: 5 });
  if (!response.success) return response;
  return { success: true, data: uniqueById(response.data.map(toReferenceOption).filter((item): item is ErpReferenceOption => Boolean(item))) };
}
