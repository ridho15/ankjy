import "server-only";
import { anikaRequest } from "@/lib/api/anikaClient";
import { failure, type ApiResponse } from "@/lib/types/api";
import type { Sale } from "@/lib/types/sales";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export type StockReleaseResult = {
  status: "released" | "already_released";
  message?: string;
  data?: unknown;
};

type ReleaseItemInput = Sale["items"][number];

function isLocalInventoryMode(): boolean {
  return process.env.INVENTORY_SOURCE !== "erp";
}

function numberId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

function releaseReferenceFor(saleId: string, erpReference?: string) {
  const ref = erpReference || saleId;
  if (ref.startsWith("SLM-STOCK-")) {
    return ref.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100);
  }
  return `SLM-STOCK-${ref}`.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 100);
}

function safeReleaseError(response: ApiResponse<unknown>) {
  if (response.success) return undefined;
  const details = response.details && typeof response.details === "object" ? response.details as Record<string, unknown> : {};
  const upstreamCode = typeof details.upstreamCode === "string" ? details.upstreamCode : "";
  const code = upstreamCode || response.code || "";

  if (code === "stock_insufficient") {
    const errors = details.errors as Record<string, unknown> | undefined;
    const items = Array.isArray(errors?.items) ? errors.items as Record<string, unknown>[] : [];
    if (items.length > 0) {
      const itemDescriptions = items.map((i) => {
        const name = String(i.product_name || i.sku || i.product_id || "Produk");
        const req = i.requested_qty !== undefined ? ` (minta: ${i.requested_qty}, tersedia: ${i.available_qty ?? 0})` : "";
        return `${name}${req}`;
      });
      return `Stok di gudang tidak mencukupi untuk item: ${itemDescriptions.join(", ")}.`;
    }
    return "Stok di gudang tidak mencukupi untuk release barang.";
  }

  if (code === "product_invalid") {
    const errors = details.errors as unknown[];
    if (Array.isArray(errors) && errors.length > 0) {
      const invalidSkus = errors.map((e: any) => e.sku || (e.product_id ? `ID #${e.product_id}` : "Produk")).join(", ");
      return `Produk berikut tidak ditemukan di master data ERP Aneka Jaya: ${invalidSkus}.`;
    }
    return "Produk ERP tidak ditemukan untuk release stok.";
  }

  const map: Record<string, string> = {
    warehouse_invalid: "Gudang ERP tidak valid atau tidak aktif.",
    rak_invalid: "Rak ERP tidak valid atau bukan milik gudang.",
    product_invalid: "Produk ERP tidak ditemukan untuk release stok.",
    hpp_invalid: "HPP/cost produk belum valid di ERP.",
    coa_invalid: "COA produk belum valid di ERP.",
    validation_failed: "Payload release stok ERP tidak valid."
  };
  return map[code] || response.message || "Release stok ERP gagal.";
}

export function buildStockReleasePayload(input: {
  saleId: string;
  saleDate: string;
  erpReference?: string;
  sourceNumber?: string;
  items: ReleaseItemInput[];
}) {
  const defaultWarehouseId = numberId(process.env.ANIKA_ERP_DEFAULT_WAREHOUSE_ID) || numberId(process.env.ANIKA_ERP_DEFAULT_CABANG_ID) || 1;
  const releaseReference = releaseReferenceFor(input.saleId, input.erpReference);
  const releaseItems = input.items.map((item) => {
    const productId = numberId(item.productId);
    const warehouseId = numberId(item.warehouseId) || defaultWarehouseId;
    const rackId = numberId(item.rackId);
    return {
      product_id: productId,
      sku: item.productRef || undefined,
      quantity: item.quantity,
      warehouse_id: warehouseId,
      rak_id: rackId
    };
  });

  const missingProduct = input.items.find((item) => !numberId(item.productId) && !item.productRef);
  if (missingProduct) return failure("Produk release stok belum lengkap.", "ERP_STOCK_RELEASE_INCOMPLETE");

  return {
    success: true as const,
    data: {
      releaseReference,
      payload: {
        reference: releaseReference,
        erp_reference: releaseReference,
        source: "SLM",
        source_type: "invoice",
        source_number: input.sourceNumber || input.erpReference || input.saleId,
        release_date: input.saleDate,
        warehouse_id: releaseItems[0]?.warehouse_id || defaultWarehouseId,
        notes: `Release stok dari transaksi SLM ${input.sourceNumber || input.erpReference || input.saleId}`,
        items: releaseItems
      }
    }
  };
}

export async function releaseSaleStock(input: {
  saleId: string;
  saleDate: string;
  erpReference?: string;
  sourceNumber?: string;
  items: ReleaseItemInput[];
}): Promise<ApiResponse<StockReleaseResult & { releaseReference: string }>> {
  const built = buildStockReleasePayload(input);
  if (!built.success) return built;
  const releaseReference = built.data.releaseReference;

  if (isLocalInventoryMode()) {
    try {
      await prisma.$transaction(async (tx) => {
        for (const item of input.items) {
          const qty = Number(item.quantity) || 0;
          if (qty <= 0) continue;

          const productKey = (item.productId || item.productRef || "").trim();
          if (!productKey) continue;

          const warehouse = (item.warehouseNameSnapshot || "Toko").trim() || "Toko";
          const rack = (item.rackNameSnapshot || "").trim();

          let product = await tx.product.findFirst({
            where: {
              OR: [{ id: productKey }, { code: productKey }]
            }
          });

          if (!product) {
            const manual = item.manualProduct as Record<string, unknown> | undefined;
            const name = String(manual?.name || item.productRef || productKey).trim();
            product = await tx.product.create({
              data: {
                code: (item.productRef || productKey).trim(),
                name,
                category: "Umum",
                unit: item.unitSnapshot || "PCS",
                sellingPrice: new Prisma.Decimal(item.unitPrice || 0),
                defaultWarehouse: warehouse,
                defaultRack: rack || null,
                isActive: true
              }
            });
          }

          const stock = await tx.warehouseStock.upsert({
            where: {
              productId_warehouse_rack: {
                productId: product.id,
                warehouse,
                rack
              }
            },
            create: {
              productId: product.id,
              warehouse,
              rack,
              quantity: new Prisma.Decimal(-qty)
            },
            update: {
              quantity: { decrement: new Prisma.Decimal(qty) }
            }
          });

          const balanceAfter = Number(stock.quantity);
          const balanceBefore = balanceAfter + qty;

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              warehouse,
              rack,
              type: "OUT_SALE",
              quantity: new Prisma.Decimal(qty),
              balanceBefore: new Prisma.Decimal(balanceBefore),
              balanceAfter: new Prisma.Decimal(balanceAfter),
              referenceType: "SALE",
              referenceId: input.sourceNumber || input.erpReference || input.saleId,
              notes: `Pengurangan stok transaksi penjualan ${input.sourceNumber || input.saleId}`
            }
          });
        }
      });

      return {
        success: true,
        data: {
          status: "released",
          releaseReference,
          message: "Stok lokal berhasil dikurangi."
        }
      };
    } catch (err: any) {
      return failure(`Gagal memotong stok lokal: ${err?.message}`, "LOCAL_STOCK_RELEASE_FAILED");
    }
  }

  const response = await anikaRequest<StockReleaseResult>("/stock-releases", {
    method: "POST",
    body: JSON.stringify(built.data.payload)
  });
  if (!response.success) return failure(safeReleaseError(response) || "Release stok ERP gagal.", response.code, response.details);
  const status = String((response.data as { status?: unknown })?.status || "").trim();
  if (status === "released" || status === "already_released") {
    return { success: true, data: { ...response.data, status, releaseReference: built.data.releaseReference }, details: response.details };
  }
  return failure(response.data?.message || "Release stok ERP belum terkonfirmasi.", "ERP_STOCK_RELEASE_UNCONFIRMED", response.data);
}

export async function cancelStockRelease(input: {
  reference: string;
  reason: string;
}): Promise<ApiResponse<{ status: "reversed"; message?: string }>> {
  if (isLocalInventoryMode()) {
    try {
      await prisma.$transaction(async (tx) => {
        const movements = await tx.stockMovement.findMany({
          where: {
            referenceId: input.reference,
            type: "OUT_SALE"
          }
        });

        for (const mov of movements) {
          const qty = Number(mov.quantity);
          const stock = await tx.warehouseStock.upsert({
            where: {
              productId_warehouse_rack: {
                productId: mov.productId,
                warehouse: mov.warehouse,
                rack: mov.rack
              }
            },
            create: {
              productId: mov.productId,
              warehouse: mov.warehouse,
              rack: mov.rack,
              quantity: new Prisma.Decimal(qty)
            },
            update: {
              quantity: { increment: new Prisma.Decimal(qty) }
            }
          });

          const balanceAfter = Number(stock.quantity);
          const balanceBefore = balanceAfter - qty;

          await tx.stockMovement.create({
            data: {
              productId: mov.productId,
              warehouse: mov.warehouse,
              rack: mov.rack,
              type: "REVERSAL_IN",
              quantity: new Prisma.Decimal(qty),
              balanceBefore: new Prisma.Decimal(balanceBefore),
              balanceAfter: new Prisma.Decimal(balanceAfter),
              referenceType: "SALE_CANCEL",
              referenceId: input.reference,
              notes: `Pembatalan/revisi stok penjualan: ${input.reason}`
            }
          });
        }
      });

      return {
        success: true,
        data: {
          status: "reversed",
          message: "Stok lokal berhasil dikembalikan."
        }
      };
    } catch (err: any) {
      return failure(`Gagal membatalkan rilis stok lokal: ${err?.message}`, "LOCAL_STOCK_REVERSAL_FAILED");
    }
  }

  const response = await anikaRequest<{ status?: string; message?: string }>("/stock-releases/cancel", {
    method: "POST",
    body: JSON.stringify({
      reference: input.reference,
      reason: input.reason
    })
  });
  if (!response.success) {
    return failure(response.message || "Gagal membatalkan rilis stok di ERP.", response.code, response.details);
  }
  return {
    success: true,
    data: {
      status: "reversed",
      message: response.data?.message
    },
    details: response.details
  };
}

export function nextRevisionReference(currentRef?: string, baseReference?: string) {
  const base = currentRef || baseReference || `SLM-STOCK-${Date.now()}`;
  const match = base.match(/-REV(\d+)$/i);
  if (match) {
    const revNum = parseInt(match[1], 10) + 1;
    return base.replace(/-REV\d+$/i, `-REV${revNum}`);
  }
  return `${base}-REV1`;
}

export function stockReleaseErrorFrom(response: ApiResponse<unknown>) {
  return safeReleaseError(response);
}
